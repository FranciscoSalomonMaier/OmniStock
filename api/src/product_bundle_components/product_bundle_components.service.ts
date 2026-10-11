import { ProductStatus } from '../products/enums/product.enums';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BundlesCompositionService } from '../product_bundles/bundles-composition/bundles-composition.service';
import { ProductBundleComponent } from './entities/product_bundle_component.entity';
import { CreateProductBundleComponentDto } from './dto/create-product_bundle_component.dto';
import { UpdateProductBundleComponentDto } from './dto/update-product_bundle_component.dto';
@Injectable()
export class ProductBundleComponentsService {
  constructor(
    private db: DataSource,
    private composition: BundlesCompositionService,
  ) {}
  async createForProduct(
    companyId: string,
    productId: string,
    dto: CreateProductBundleComponentDto,
  ) {
    return this.db.transaction(async (m) => {
      await this.composition.lock(companyId, m);
      await this.composition.product(companyId, productId, m);
      const bundle = await this.composition.getActiveBundleForProduct(
        productId,
        companyId,
        m,
      );
      if (!bundle)
        throw new NotFoundException('Crie a composição do kit primeiro.');
      const p = await this.composition.product(
        companyId,
        dto.componentProductId,
        m,
      );
      if (
        p.status !== ProductStatus.ACTIVE ||
        !Number.isSafeInteger(dto.quantity) ||
        dto.quantity <= 0
      )
        throw new BadRequestException(
          'Componente ativo e quantidade inteira positiva são obrigatórios.',
        );
      if (await this.composition.detectCycle(productId, p.id, companyId, m))
        throw new BadRequestException('A composição contém um ciclo.');
      const existing = await m.findOneBy(ProductBundleComponent, {
        companyId,
        bundleId: bundle.id,
        componentProductId: p.id,
      });
      if (existing?.active)
        throw new BadRequestException('Componente duplicado.');
      const c =
        existing ??
        m.create(ProductBundleComponent, {
          companyId,
          bundleId: bundle.id,
          componentProductId: p.id,
        });
      c.quantity = dto.quantity;
      c.active = true;
      const saved = await m.save(c);
      await this.composition.queueChanges(companyId, productId, m, true);
      return saved;
    });
  }
  async findAllForProduct(companyId: string, productId: string) {
    return this.composition.describe(companyId, productId);
  }
  async update(
    companyId: string,
    productId: string,
    id: string,
    dto: UpdateProductBundleComponentDto,
  ) {
    return this.change(companyId, productId, id, dto.quantity, false);
  }
  async remove(companyId: string, productId: string, id: string) {
    return this.change(companyId, productId, id, undefined, true);
  }
  private async change(
    companyId: string,
    productId: string,
    id: string,
    quantity: number | undefined,
    remove: boolean,
  ) {
    return this.db.transaction(async (m) => {
      await this.composition.lock(companyId, m);
      const bundle = await this.composition.getActiveBundleForProduct(
        productId,
        companyId,
        m,
      );
      if (!bundle) throw new NotFoundException('Kit não encontrado.');
      const c = await m.findOneBy(ProductBundleComponent, {
        id,
        companyId,
        bundleId: bundle.id,
        active: true,
      });
      if (!c) throw new NotFoundException('Componente não pertence ao kit.');
      if (quantity !== undefined) {
        if (!Number.isSafeInteger(quantity) || quantity <= 0)
          throw new BadRequestException(
            'Quantidade inteira positiva obrigatória.',
          );
        c.quantity = quantity;
      }
      if (remove) c.active = false;
      const saved = await m.save(c);
      await this.composition.queueChanges(companyId, productId, m, true);
      return saved;
    });
  }
}
