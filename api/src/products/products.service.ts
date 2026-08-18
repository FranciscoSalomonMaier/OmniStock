import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductStatus } from './enums/product.enums';
import { LocalStorageService } from './storage/local-storage.service';
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categories: Repository<ProductCategory>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    private readonly storage: LocalStorageService,
    private readonly config: ConfigService,
  ) {}
  async create(companyId: string, userId: string, dto: CreateProductDto) {
    await this.validateCategory(companyId, dto.categoryId);
    this.validateBarcode(dto.barcode);
    try {
      const product = await this.products.save(
        this.products.create({
          ...dto,
          companyId,
          categoryId: dto.categoryId ?? null,
          description: dto.description ?? null,
          barcode: dto.barcode ?? null,
          costPrice: dto.costPrice ?? null,
          ncm: dto.ncm ?? null,
          cest: dto.cest ?? null,
          defaultCfop: dto.defaultCfop ?? null,
          merchandiseOrigin: dto.merchandiseOrigin ?? null,
          weight: dto.weight ?? null,
          height: dto.height ?? null,
          width: dto.width ?? null,
          length: dto.length ?? null,
        }),
      );
      this.logger.log({
        event: 'product.created',
        companyId,
        productId: product.id,
        userId,
      });
      return product;
    } catch (e: unknown) {
      this.conflict(e);
      throw e;
    }
  }
  async list(companyId: string, role: CompanyRole, q: ListProductsQueryDto) {
    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndMapOne(
        'product.primaryImage',
        ProductImage,
        'primaryImage',
        'primaryImage.productId = product.id AND primaryImage.companyId = :companyId AND primaryImage.isPrimary = true',
        { companyId },
      )
      .where('product.companyId = :companyId', { companyId });
    if (q.search)
      qb.andWhere(
        new Brackets((x) =>
          x
            .where('product.sku ILIKE :search')
            .orWhere('product.name ILIKE :search')
            .orWhere('product.barcode ILIKE :search'),
        ),
      ).setParameter('search', `%${q.search}%`);
    if (q.sku)
      qb.andWhere('product.sku = :sku', { sku: q.sku.trim().toUpperCase() });
    if (q.barcode)
      qb.andWhere('product.barcode = :barcode', { barcode: q.barcode });
    if (q.categoryId)
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: q.categoryId,
      });
    if (q.status) qb.andWhere('product.status = :status', { status: q.status });
    if (q.unitOfMeasure)
      qb.andWhere('product.unitOfMeasure = :unit', { unit: q.unitOfMeasure });
    if (q.minSalePrice)
      qb.andWhere('product.salePrice >= :min', { min: q.minSalePrice });
    if (q.maxSalePrice)
      qb.andWhere('product.salePrice <= :max', { max: q.maxSalePrice });
    const sort: { [key: string]: string } = {
      createdAt: 'product.createdAt',
      updatedAt: 'product.updatedAt',
      name: 'product.name',
      sku: 'product.sku',
      salePrice: 'product.salePrice',
    };
    qb.orderBy(sort[q.sortBy], q.sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((p) => this.visible(p, role)),
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
  async get(companyId: string, id: string, role?: CompanyRole) {
    const product = await this.products.findOne({
      where: { id, companyId },
      relations: { category: true, images: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return role ? this.visible(product, role) : product;
  }
  async update(
    companyId: string,
    id: string,
    userId: string,
    dto: UpdateProductDto,
  ) {
    const product = (await this.get(companyId, id)) as Product;
    await this.validateCategory(companyId, dto.categoryId);
    this.validateBarcode(dto.barcode);
    const oldSku = product.sku;
    Object.assign(product, dto);
    try {
      const saved = await this.products.save(product);
      this.logger.log({
        event: 'product.updated',
        companyId,
        productId: id,
        userId,
        skuChanged: oldSku !== saved.sku,
      });
      return saved;
    } catch (e: unknown) {
      this.conflict(e);
      throw e;
    }
  }
  async status(
    companyId: string,
    id: string,
    userId: string,
    status: ProductStatus,
  ) {
    const product = (await this.get(companyId, id)) as Product;
    product.status = status;
    const saved = await this.products.save(product);
    this.logger.log({
      event: 'product.status_changed',
      companyId,
      productId: id,
      userId,
      status,
    });
    return saved;
  }
  async addImage(
    companyId: string,
    productId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    await this.get(companyId, productId);
    const maxSize =
      this.config.getOrThrow<number>('PRODUCT_IMAGE_MAX_SIZE_MB') * 1024 * 1024;
    if (file.size > maxSize)
      throw new BadRequestException('Arquivo excede o limite configurado');
    const max = this.config.getOrThrow<number>('PRODUCT_IMAGE_MAX_COUNT');
    if ((await this.images.countBy({ companyId, productId })) >= max)
      throw new BadRequestException(`Limite de ${max} imagens atingido`);
    const key = await this.storage.save(companyId, productId, file);
    try {
      const count = await this.images.countBy({ companyId, productId });
      const image = await this.images.save(
        this.images.create({
          companyId,
          productId,
          storageKey: key,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          sortOrder: count,
          isPrimary: count === 0,
        }),
      );
      this.logger.log({
        event: 'product.image_added',
        companyId,
        productId,
        imageId: image.id,
        userId,
      });
      return this.imageView(image);
    } catch (e) {
      await this.storage.remove(key);
      throw e;
    }
  }
  async listImages(companyId: string, productId: string) {
    await this.get(companyId, productId);
    return (
      await this.images.find({
        where: { companyId, productId },
        order: { sortOrder: 'ASC' },
      })
    ).map((i) => this.imageView(i));
  }
  async imageFile(companyId: string, productId: string, imageId: string) {
    const image = await this.images.findOneBy({
      id: imageId,
      companyId,
      productId,
    });
    if (!image) throw new NotFoundException('Imagem não encontrada');
    return {
      buffer: await this.storage.read(image.storageKey),
      mimeType: image.mimeType,
    };
  }
  async primary(companyId: string, productId: string, imageId: string) {
    const image = await this.images.findOneBy({
      id: imageId,
      companyId,
      productId,
    });
    if (!image) throw new NotFoundException('Imagem não encontrada');
    await this.images.manager.transaction(async (m) => {
      await m.update(
        ProductImage,
        { companyId, productId },
        { isPrimary: false },
      );
      await m.update(
        ProductImage,
        { id: imageId, companyId, productId },
        { isPrimary: true },
      );
    });
    return this.imageView({ ...image, isPrimary: true });
  }
  async reorder(companyId: string, productId: string, ids: string[]) {
    const images = await this.images.findBy({ companyId, productId });
    if (
      ids.length !== images.length ||
      ids.some((id) => !images.some((i) => i.id === id))
    )
      throw new BadRequestException('Lista de imagens inválida');
    await this.images.manager.transaction(async (m) =>
      Promise.all(
        ids.map((id, index) =>
          m.update(
            ProductImage,
            { id, companyId, productId },
            { sortOrder: index },
          ),
        ),
      ),
    );
    return this.listImages(companyId, productId);
  }
  async removeImage(
    companyId: string,
    productId: string,
    imageId: string,
    userId: string,
  ) {
    const image = await this.images.findOneBy({
      id: imageId,
      companyId,
      productId,
    });
    if (!image) throw new NotFoundException('Imagem não encontrada');
    await this.images.remove(image);
    await this.storage.remove(image.storageKey);
    if (image.isPrimary) {
      const next = await this.images.findOne({
        where: { companyId, productId },
        order: { sortOrder: 'ASC' },
      });
      if (next)
        await this.images.update(
          { id: next.id, companyId, productId },
          { isPrimary: true },
        );
    }
    this.logger.log({
      event: 'product.image_removed',
      companyId,
      productId,
      imageId,
      userId,
    });
  }
  private async validateCategory(companyId: string, id?: string | null) {
    if (!id) return;
    const category = await this.categories.findOneBy({
      id,
      companyId,
      isActive: true,
    });
    if (!category)
      throw new BadRequestException('Categoria inválida ou inativa');
  }
  private validateBarcode(value?: string | null) {
    if (!value || ![8, 13].includes(value.length)) return;
    if (!/^\d+$/.test(value))
      throw new BadRequestException('Código de barras inválido');
    const digits = value.split('').map(Number),
      check = digits.pop()!;
    let sum = 0;
    for (let i = digits.length - 1, pos = 0; i >= 0; i--, pos++)
      sum += digits[i] * (pos % 2 === 0 ? 3 : 1);
    if ((10 - (sum % 10)) % 10 !== check)
      throw new BadRequestException('Código de barras inválido');
  }
  private conflict(e: unknown): never | void {
    if (typeof e === 'object' && e && 'code' in e && e.code === '23505') {
      const detail = 'detail' in e ? String(e.detail) : '';
      throw new ConflictException(
        detail.includes('barcode')
          ? 'Já existe um produto com este código de barras nesta empresa.'
          : 'Já existe um produto com este SKU nesta empresa.',
      );
    }
  }
  private visible(product: Product, role: CompanyRole) {
    if ([CompanyRole.SUPPORT, CompanyRole.VIEWER].includes(role)) {
      const safe: Record<string, unknown> = { ...product };
      delete safe.costPrice;
      return safe;
    }
    return product;
  }
  private imageView(i: ProductImage) {
    const safe: Record<string, unknown> = { ...i };
    delete safe.storageKey;
    return { ...safe, url: `/api/products/${i.productId}/images/${i.id}/file` };
  }
}
