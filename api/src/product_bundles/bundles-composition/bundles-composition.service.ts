import { ProductStatus } from '../../products/enums/product.enums';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProductBundle } from '../entities/product_bundle.entity';
import { ProductBundleComponent } from '../../product_bundle_components/entities/product_bundle_component.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import {
  InventoryOutboxEvent,
  OutboxEventStatus,
} from '../../inventory/entities/inventory-outbox-event.entity';
import { decimal, units } from '../../inventory/quantity';
import { randomUUID } from 'crypto';

@Injectable()
export class BundlesCompositionService {
  constructor(private readonly db: DataSource) {}
  async lock(companyId: string, m: EntityManager) {
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `bundle:${companyId}`,
    ]);
  }
  async product(companyId: string, id: string, m = this.db.manager) {
    const product = await m.findOneBy(Product, { id, companyId });
    if (!product)
      throw new NotFoundException(
        'Produto não encontrado na empresa selecionada.',
      );
    return product;
  }
  getActiveBundleForProduct(
    productId: string,
    companyId: string,
    m = this.db.manager,
  ) {
    return m.findOneBy(ProductBundle, {
      bundleProductId: productId,
      companyId,
      active: true,
    });
  }
  async composition(
    productId: string,
    companyId: string,
    m = this.db.manager,
  ): Promise<ProductBundleComponent[]> {
    await this.product(companyId, productId, m);
    const bundle = await this.getActiveBundleForProduct(
      productId,
      companyId,
      m,
    );
    return bundle
      ? m.find<ProductBundleComponent>(ProductBundleComponent, {
          where: { bundleId: bundle.id, companyId, active: true },
          relations: { componentProduct: true },
        })
      : [];
  }
  async detectCycle(
    bundleProductId: string,
    componentProductId: string,
    companyId: string,
    m = this.db.manager,
  ) {
    const pending = [componentProductId],
      seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (id === bundleProductId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const bundle = await this.getActiveBundleForProduct(id, companyId, m);
      if (bundle)
        pending.push(
          ...(
            await m.findBy(ProductBundleComponent, {
              bundleId: bundle.id,
              companyId,
              active: true,
            })
          ).map((c) => c.componentProductId),
        );
    }
    return false;
  }
  async validateComposition(
    productId: string,
    companyId: string,
    m = this.db.manager,
  ) {
    try {
      await this.expandBundleComponents(productId, '1', companyId, m);
      return true;
    } catch {
      return false;
    }
  }
  async expandBundleComponents(
    productId: string,
    soldQuantity: string,
    companyId: string,
    m = this.db.manager,
  ) {
    const sold = units(soldQuantity);
    if (sold <= 0n)
      throw new BadRequestException('Quantidade vendida deve ser positiva.');
    const result = new Map<string, bigint>();
    const visit = async (id: string, qty: bigint, path: Set<string>) => {
      if (path.has(id))
        throw new BadRequestException('A composição contém um ciclo.');
      const product = await this.product(companyId, id, m);
      if (product.status !== ProductStatus.ACTIVE)
        throw new BadRequestException('Componente inativo.');
      const bundle = await this.getActiveBundleForProduct(id, companyId, m);
      if (!bundle) {
        result.set(id, (result.get(id) ?? 0n) + qty);
        return;
      }
      const components = await m.findBy(ProductBundleComponent, {
        bundleId: bundle.id,
        companyId,
        active: true,
      });
      if (!components.length)
        throw new BadRequestException(
          'O kit precisa de ao menos um componente.',
        );
      const next = new Set(path).add(id);
      for (const c of components) {
        if (!Number.isSafeInteger(c.quantity) || c.quantity <= 0)
          throw new BadRequestException('Composição inválida.');
        await visit(c.componentProductId, qty * BigInt(c.quantity), next);
      }
    };
    await visit(productId, sold, new Set());
    return [...result]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([productId, qty]) => ({ productId, quantity: decimal(qty) }));
  }
  async calculateMaxAvaliableKits(
    productId: string,
    companyId: string,
    m = this.db.manager,
  ) {
    const components = await this.expandBundleComponents(
      productId,
      '1',
      companyId,
      m,
    );
    let limit: bigint | null = null;
    for (const c of components) {
      const balance = await m.findOneBy(InventoryBalance, {
        companyId,
        productId: c.productId,
      });
      const available = balance
        ? units(balance.currentQuantity) - units(balance.reservedQuantity)
        : 0n;
      const n = (available > 0n ? available : 0n) / units(c.quantity);
      limit = limit === null || n < limit ? n : limit;
    }
    const n = Number(limit ?? 0n);
    if (!Number.isSafeInteger(n) || n > 2147483647)
      throw new BadRequestException('Saldo excede o limite do marketplace.');
    return n;
  }
  async describe(companyId: string, productId: string, m = this.db.manager) {
    await this.product(companyId, productId, m);
    const bundle = await this.getActiveBundleForProduct(
      productId,
      companyId,
      m,
    );
    const components = await this.composition(productId, companyId, m);
    let availableKits = 0;
    let compositionValid = !bundle;
    if (bundle && components.length) {
      try {
        availableKits = await this.calculateMaxAvaliableKits(
          productId,
          companyId,
          m,
        );
        compositionValid = true;
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
      }
    }
    return {
      compositionValid,
      isBundle: Boolean(bundle),
      bundleId: bundle?.id ?? null,
      components: components.map((c) => ({
        id: c.id,
        productId: c.componentProductId,
        productName: c.componentProduct.name,
        quantity: Number(c.quantity).toFixed(3),
      })),
      availableKits,
    };
  }
  async dependentProducts(
    companyId: string,
    productId: string,
    m = this.db.manager,
  ): Promise<string[]> {
    const rows: Array<{ id: string }> = await m.query(
      `WITH RECURSIVE dependents(id) AS (
      SELECT b.bundle_product_id FROM product_bundles b JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=b.company_id WHERE b.company_id=$1 AND b.active AND c.active AND c.component_product_id=$2
      UNION SELECT b.bundle_product_id FROM product_bundles b JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=b.company_id JOIN dependents d ON c.component_product_id=d.id WHERE b.company_id=$1 AND b.active AND c.active)
      SELECT id FROM dependents ORDER BY id`,
      [companyId, productId],
    );
    return rows.map((r) => r.id);
  }
  async queueChanges(
    companyId: string,
    productId: string,
    m: EntityManager,
    includeSelf = false,
  ) {
    const ids = await this.dependentProducts(companyId, productId, m);
    if (includeSelf) ids.push(productId);
    for (const id of [...new Set(ids)].sort()) {
      // Zero balances carry synchronization versions only; kits have no physical stock.
      const rows: Array<{ version: number }> = await m.query(
        `INSERT INTO inventory_balances(company_id,product_id,current_quantity,reserved_quantity) VALUES($1,$2,0,0) ON CONFLICT(company_id,product_id) DO UPDATE SET version=inventory_balances.version+1,updated_at=now() RETURNING version`,
        [companyId, id],
      );
      const currentAvailable = (await this.describe(companyId, id, m))
        .availableKits;
      await m.save(
        InventoryOutboxEvent,
        m.create(InventoryOutboxEvent, {
          companyId,
          aggregateType: 'INVENTORY',
          aggregateId: id,
          eventType: 'InventoryAvailabilityChanged',
          payload: {
            companyId,
            productId: id,
            currentAvailable,
            inventoryVersion: rows[0].version,
            correlationId: randomUUID(),
            source: 'BUNDLE_COMPONENT_CHANGE',
          },
          status: OutboxEventStatus.PENDING,
          attempts: 0,
          availableAt: new Date(),
          processedAt: null,
          lastError: null,
        }),
      );
    }
  }
}
