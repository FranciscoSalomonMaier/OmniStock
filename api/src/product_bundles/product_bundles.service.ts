import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProductBundle } from './entities/product_bundle.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryBalance } from '../inventory/entities/inventory-balance.entity';
import { BundlesCompositionService } from './bundles-composition/bundles-composition.service';
import { CreateProductBundleDto } from './dto/create-product_bundle.dto';
import { UpdateProductBundleDto } from './dto/update-product_bundle.dto';
@Injectable()
export class ProductBundlesService {
  constructor(
    private db: DataSource,
    private composition: BundlesCompositionService,
  ) {}
  async create(companyId: string, dto: CreateProductBundleDto) {
    return this.db.transaction(async (m) => {
      await this.composition.lock(companyId, m);
      await this.composition.product(companyId, dto.bundleProductId, m);
      const existing = await this.composition.getActiveBundleForProduct(
        dto.bundleProductId,
        companyId,
        m,
      );
      if (existing) return existing;
      const balance = await m.findOneBy(InventoryBalance, {
        companyId,
        productId: dto.bundleProductId,
      });
      if (
        (balance &&
          (Number(balance.currentQuantity) ||
            Number(balance.reservedQuantity))) ||
        (await m.existsBy(InventoryMovement, {
          companyId,
          productId: dto.bundleProductId,
        }))
      )
        throw new ConflictException(
          'Cadastre um produto comercial separado: este produto já possui estoque ou movimentações físicas.',
        );
      return m.save(
        ProductBundle,
        m.create(ProductBundle, {
          companyId,
          bundleProductId: dto.bundleProductId,
          active: dto.active ?? true,
        }),
      );
    });
  }
  findAll(companyId: string) {
    return this.db.manager.findBy(ProductBundle, { companyId, active: true });
  }
  async findOne(companyId: string, id: string) {
    const b = await this.db.manager.findOneBy(ProductBundle, { id, companyId });
    if (!b) throw new NotFoundException('Kit não encontrado.');
    return {
      ...b,
      ...(await this.composition.describe(companyId, b.bundleProductId)),
    };
  }
  async update(companyId: string, id: string, dto: UpdateProductBundleDto) {
    return this.db.transaction(async (m) => {
      await this.composition.lock(companyId, m);
      const b = await m.findOneBy(ProductBundle, { id, companyId });
      if (!b) throw new NotFoundException('Kit não encontrado.');
      if (dto.active === false)
        throw new BadRequestException(
          'Mantenha o produto como kit e remova ou edite seus componentes. Para interromper vendas, inative o produto.',
        );
      if (dto.active === true && !b.active)
        throw new BadRequestException(
          'Crie uma nova composição para o produto.',
        );
      return b;
    });
  }
  remove(companyId: string, id: string) {
    return this.update(companyId, id, { active: false });
  }
}
