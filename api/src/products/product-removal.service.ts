import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductBundle } from '../product_bundles/entities/product_bundle.entity';
import { ProductBundleComponent } from '../product_bundle_components/entities/product_bundle_component.entity';
import { BundlesCompositionService } from '../product_bundles/bundles-composition/bundles-composition.service';
import { LocalStorageService } from './storage/local-storage.service';

@Injectable()
export class ProductRemovalService {
  private readonly log = new Logger(ProductRemovalService.name);
  constructor(
    private readonly db: DataSource,
    private readonly bundles: BundlesCompositionService,
    private readonly storage: LocalStorageService,
  ) {}

  private async inspect(
    companyId: string,
    productId: string,
    m: EntityManager,
  ) {
    const product = await m.findOneBy(Product, { id: productId, companyId });
    if (!product)
      throw new NotFoundException('Produto não encontrado nesta empresa.');
    const kits = await m.query<
      Array<{ id: string; sku: string; name: string }>
    >(
      `SELECT DISTINCT p.id,p.sku,p.name FROM product_bundle_components c
       JOIN product_bundles b ON b.id=c.bundle_id AND b.company_id=c.company_id
       JOIN products p ON p.id=b.bundle_product_id AND p.company_id=b.company_id
       WHERE c.company_id=$1 AND c.component_product_id=$2 AND c.active AND b.active
       ORDER BY p.sku`,
      [companyId, productId],
    );
    if (kits.length)
      return {
        allowed: false,
        reason: 'USED_IN_KITS',
        reasons: ['Vinculado a kits'],
        kits,
        message:
          'Este produto está vinculado a um ou mais kits. Remova primeiro os kits que o utilizam ou retire o produto da composição deles.',
      };
    // History is never removed or detached to force a product deletion.
    const [usage] = await m.query<
      Array<{
        stock: boolean;
        stockHistory: boolean;
        orderHistory: boolean;
        marketplaceLink: boolean;
        syncHistory: boolean;
        fiscalLink: boolean;
        pendingProcessing: boolean;
      }>
    >(
      `SELECT
        EXISTS(SELECT 1 FROM inventory_balances WHERE company_id=$1 AND product_id=$2 AND (current_quantity<>0 OR reserved_quantity<>0)) AS "stock",
        (EXISTS(SELECT 1 FROM inventory_movements WHERE company_id=$1 AND product_id=$2) OR
         EXISTS(SELECT 1 FROM inventory_reservations WHERE company_id=$1 AND product_id=$2)) AS "stockHistory",
        (EXISTS(SELECT 1 FROM order_items WHERE company_id=$1 AND product_id=$2) OR
         EXISTS(SELECT 1 FROM order_item_components WHERE company_id=$1 AND component_product_id=$2)) AS "orderHistory",
        EXISTS(SELECT 1 FROM product_marketplace_links WHERE company_id=$1 AND product_id=$2) AS "marketplaceLink",
        (EXISTS(SELECT 1 FROM marketplace_stock_syncs WHERE company_id=$1 AND product_id=$2) OR
         EXISTS(SELECT 1 FROM marketplace_stock_divergences WHERE company_id=$1 AND product_id=$2)) AS "syncHistory",
        (EXISTS(SELECT 1 FROM product_fiscal_profiles WHERE company_id=$1 AND product_id=$2) OR
         EXISTS(SELECT 1 FROM product_tax_rules WHERE company_id=$1 AND product_id=$2)) AS "fiscalLink",
        EXISTS(SELECT 1 FROM outbox_events WHERE company_id=$1 AND aggregate_id=$2 AND status IN ('PENDING','PROCESSING','RETRYING')) AS "pendingProcessing"`,
      [companyId, productId],
    );
    const reasons = [
      usage.stock && 'Possui estoque',
      usage.stockHistory && 'Possui movimentações ou reservas de estoque',
      usage.orderHistory && 'Possui histórico de pedidos',
      usage.marketplaceLink && 'Vinculado a anúncios',
      usage.syncHistory && 'Possui histórico de sincronização',
      usage.fiscalLink && 'Vínculo fiscal',
      usage.pendingProcessing && 'Possui processamento pendente',
    ].filter((reason): reason is string => Boolean(reason));
    return reasons.length
      ? {
          allowed: false,
          reason: 'HAS_DEPENDENCIES',
          reasons,
          kits: [],
          message:
            'Este produto possui estoque, histórico, vínculos ou processamento pendente e não pode ser removido. Preserve o cadastro e, se necessário, inative o produto.',
        }
      : { allowed: true, reason: null, reasons: [], kits: [], message: null };
  }
  check(companyId: string, productId: string) {
    return this.inspect(companyId, productId, this.db.manager);
  }

  async remove(companyId: string, productId: string, userId: string) {
    let images: ProductImage[];
    try {
      images = await this.db.transaction(async (m) => {
        await this.bundles.lock(companyId, m);
        const product = await m.findOne(Product, {
          where: { id: productId, companyId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product)
          throw new NotFoundException('Produto não encontrado nesta empresa.');
        const check = await this.inspect(companyId, productId, m);
        if (!check.allowed)
          throw new ConflictException({
            code: check.reason,
            message: check.message,
            reasons: check.reasons,
            kits: check.kits,
          });
        const files = await m.findBy(ProductImage, { companyId, productId });
        const ownKits = await m.findBy(ProductBundle, {
          companyId,
          bundleProductId: productId,
        });
        for (const kit of ownKits)
          await m.delete(ProductBundleComponent, {
            companyId,
            bundleId: kit.id,
          });
        await m.delete(ProductBundleComponent, {
          companyId,
          componentProductId: productId,
        }); // inactive links only
        await m.delete(ProductBundle, {
          companyId,
          bundleProductId: productId,
        });
        await m.query(
          'DELETE FROM inventory_balances WHERE company_id=$1 AND product_id=$2 AND current_quantity=0 AND reserved_quantity=0',
          [companyId, productId],
        );
        await m.delete(ProductImage, { companyId, productId });
        await m.delete(Product, { companyId, id: productId });
        return files;
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23503'
      )
        throw new ConflictException(
          'Este produto possui vínculos ou histórico e não pode ser removido. Inative o produto para preservar os dados.',
        );
      throw error;
    }
    const cleanup = await Promise.allSettled(
      images.map((image) => this.storage.remove(image.storageKey)),
    );
    if (cleanup.some((x) => x.status === 'rejected'))
      this.log.warn({
        event: 'product.image_cleanup_pending',
        companyId,
        productId,
      });
    this.log.log({ event: 'product.removed', companyId, productId, userId });
  }
}
