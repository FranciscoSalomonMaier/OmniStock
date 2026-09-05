import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import {
  Brackets,
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product.enums';
import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannel } from '../sales-channels/entities/sales-channel.entity';
import { SalesChannelConnectionStatus } from '../sales-channels/enums/sales-channel.enums';
import {
  BulkProductMarketplaceLinksDto,
  CreateProductMarketplaceLinkDto,
  ListProductMarketplaceLinksDto,
  ListUnlinkedMarketplaceListingsDto,
  ListUnlinkedProductsDto,
} from './dto/product-marketplace-link.dto';
import { ProductMarketplaceLinkAudit } from './entities/product-marketplace-link-audit.entity';
import { ProductMarketplaceLink } from './entities/product-marketplace-link.entity';
import {
  ProductMarketplaceLinkEvent,
  ProductMarketplaceLinkSource,
  ProductMarketplaceLinkStatus,
  ProductMarketplaceLinkValidationStatus,
  ProductMarketplaceMatchedByField,
} from './enums/product-marketplace-link.enums';
import { MarketplaceLinkSuggestionService } from './marketplace-link-suggestion.service';

type LinkOrigin = {
  source: ProductMarketplaceLinkSource;
  matchedBy: ProductMarketplaceMatchedByField;
  confidence: string | null;
  event: ProductMarketplaceLinkEvent;
};

@Injectable()
export class ProductMarketplaceLinksService {
  private readonly logger = new Logger(ProductMarketplaceLinksService.name);
  constructor(
    private readonly db: DataSource,
    @InjectRepository(ProductMarketplaceLink)
    private readonly links: Repository<ProductMarketplaceLink>,
    @InjectRepository(ProductMarketplaceLinkAudit)
    private readonly audits: Repository<ProductMarketplaceLinkAudit>,
    @InjectRepository(MarketplaceListing)
    private readonly listings: Repository<MarketplaceListing>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly suggestions: MarketplaceLinkSuggestionService,
  ) {}

  create(
    companyId: string,
    userId: string,
    dto: CreateProductMarketplaceLinkDto,
    idempotencyKey: string,
  ) {
    return this.createWithOrigin(companyId, userId, dto, idempotencyKey, {
      source: ProductMarketplaceLinkSource.MANUAL,
      matchedBy: ProductMarketplaceMatchedByField.MANUAL_SELECTION,
      confidence: null,
      event: ProductMarketplaceLinkEvent.LINK_CREATED,
    });
  }

  async acceptSuggestion(
    companyId: string,
    userId: string,
    listingId: string,
    productId: string,
    idempotencyKey: string,
  ) {
    const listing = await this.listings.findOneBy({ id: listingId, companyId });
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    const suggestion = await this.suggestions.forListing(companyId, listing);
    const exact = suggestion?.productId === productId;
    return this.createWithOrigin(
      companyId,
      userId,
      { productId, marketplaceListingId: listingId },
      idempotencyKey,
      exact
        ? {
            source: ProductMarketplaceLinkSource.SKU_EXACT_MATCH,
            matchedBy: ProductMarketplaceMatchedByField.SKU,
            confidence: '1.0000',
            event: ProductMarketplaceLinkEvent.SUGGESTION_ACCEPTED,
          }
        : {
            source: ProductMarketplaceLinkSource.MANUAL,
            matchedBy: ProductMarketplaceMatchedByField.MANUAL_SELECTION,
            confidence: null,
            event: ProductMarketplaceLinkEvent.LINK_CREATED,
          },
    );
  }

  async bulk(
    companyId: string,
    userId: string,
    dto: BulkProductMarketplaceLinksDto,
    idempotencyKey: string,
  ) {
    this.key(idempotencyKey);
    const pairs = dto.links.map(
      (x) => `${x.productId}:${x.marketplaceListingId}`,
    );
    if (new Set(pairs).size !== pairs.length)
      throw new BadRequestException('O lote contém vínculos duplicados.');
    const results: Array<Record<string, unknown>> = [];
    for (let index = 0; index < dto.links.length; index++) {
      try {
        const data = await this.createWithOrigin(
          companyId,
          userId,
          dto.links[index],
          `${idempotencyKey}:${index}`,
          {
            source: ProductMarketplaceLinkSource.MANUAL,
            matchedBy: ProductMarketplaceMatchedByField.MANUAL_SELECTION,
            confidence: null,
            event: ProductMarketplaceLinkEvent.BULK_LINK_CREATED,
          },
        );
        results.push({ index, success: true, data });
      } catch (error) {
        results.push({
          index,
          success: false,
          code: this.errorCode(error),
          message:
            error instanceof Error ? error.message : 'Falha ao vincular.',
        });
      }
    }
    return { results };
  }

  async unlink(
    companyId: string,
    userId: string,
    id: string,
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    this.key(idempotencyKey);
    const hash = this.hash({ action: 'unlink', id, reason: reason ?? null });
    return this.db
      .transaction(async (m) => {
        const replay = await this.replay(m, companyId, idempotencyKey, hash);
        if (replay) return replay;
        const link = await m
          .getRepository(ProductMarketplaceLink)
          .createQueryBuilder('link')
          .setLock('pessimistic_write')
          .where('link.id = :id AND link.company_id = :companyId', {
            id,
            companyId,
          })
          .getOne();
        if (!link) throw new NotFoundException('Vínculo não encontrado.');
        if (link.status !== ProductMarketplaceLinkStatus.ACTIVE)
          throw new ConflictException({
            code: 'MARKETPLACE_LINK_ALREADY_UNLINKED',
            message: 'Este vínculo já foi desvinculado.',
          });
        link.status = ProductMarketplaceLinkStatus.INACTIVE;
        link.unlinkedAt = new Date();
        link.unlinkedByUserId = userId;
        link.unlinkReason = reason?.trim() || null;
        await m.save(link);
        const response = await this.viewByManager(m, companyId, link.id);
        await this.audit(m, {
          companyId,
          userId,
          link,
          event: ProductMarketplaceLinkEvent.LINK_UNLINKED,
          idempotencyKey,
          requestHash: hash,
          details: { reason: link.unlinkReason },
          response,
        });
        return response;
      })
      .catch((error: unknown) =>
        this.idempotencyRace(error, companyId, idempotencyKey, hash),
      );
  }

  async validate(
    companyId: string,
    userId: string,
    id: string,
    idempotencyKey: string,
  ) {
    this.key(idempotencyKey);
    const hash = this.hash({ action: 'validate', id });
    return this.db
      .transaction(async (m) => {
        const replay = await this.replay(m, companyId, idempotencyKey, hash);
        if (replay) return replay;
        const link = await this.linkQuery(
          m.getRepository(ProductMarketplaceLink),
          companyId,
        )
          .andWhere('link.id = :id', { id })
          .setLock('pessimistic_write', undefined, ['link'])
          .getOne();
        if (!link) throw new NotFoundException('Vínculo não encontrado.');
        let status = ProductMarketplaceLinkValidationStatus.VALID;
        const messages: string[] = [];
        if (link.product.status !== ProductStatus.ACTIVE) {
          status = ProductMarketplaceLinkValidationStatus.INVALID;
          messages.push('O produto interno não está ativo.');
        }
        if (
          link.listing.connection.status !==
          SalesChannelConnectionStatus.CONNECTED
        ) {
          status = ProductMarketplaceLinkValidationStatus.INVALID;
          messages.push('A conexão do canal não está ativa.');
        }
        if (['closed', 'deleted'].includes(link.listing.status.toLowerCase())) {
          status = ProductMarketplaceLinkValidationStatus.INVALID;
          messages.push('O anúncio não está mais disponível no canal.');
        } else if (
          link.listing.status.toLowerCase() !== 'active' &&
          status === ProductMarketplaceLinkValidationStatus.VALID
        ) {
          status = ProductMarketplaceLinkValidationStatus.WARNING;
          messages.push(`O anúncio está com status ${link.listing.status}.`);
        }
        const created = await m
          .getRepository(ProductMarketplaceLinkAudit)
          .createQueryBuilder('audit')
          .where('audit.companyId = :companyId AND audit.linkId = :linkId', {
            companyId,
            linkId: link.id,
          })
          .andWhere('audit.event IN (:...events)', {
            events: [
              ProductMarketplaceLinkEvent.LINK_CREATED,
              ProductMarketplaceLinkEvent.SUGGESTION_ACCEPTED,
              ProductMarketplaceLinkEvent.BULK_LINK_CREATED,
            ],
          })
          .orderBy('audit.createdAt', 'ASC')
          .getOne();
        const originalSku = created?.details?.externalSku;
        if (
          typeof originalSku === 'string' &&
          originalSku !== link.listing.externalSku
        ) {
          if (status === ProductMarketplaceLinkValidationStatus.VALID)
            status = ProductMarketplaceLinkValidationStatus.WARNING;
          messages.push('O SKU externo foi alterado desde a vinculação.');
        }
        link.lastValidatedAt = new Date();
        link.lastValidationStatus = status;
        link.lastValidationMessage =
          messages.join(' ') || 'Produto e anúncio válidos.';
        await m.save(link);
        const response = await this.viewByManager(m, companyId, id);
        await this.audit(m, {
          companyId,
          userId,
          link,
          event: ProductMarketplaceLinkEvent.LINK_VALIDATED,
          idempotencyKey,
          requestHash: hash,
          details: { validationStatus: status, messages },
          response,
        });
        return response;
      })
      .catch((error: unknown) =>
        this.idempotencyRace(error, companyId, idempotencyKey, hash),
      );
  }

  async list(companyId: string, q: ListProductMarketplaceLinksDto) {
    const qb = this.linkQuery(this.links, companyId);
    if (q.search)
      qb.andWhere(
        new Brackets((x) =>
          x
            .where('product.sku ILIKE :search')
            .orWhere('product.name ILIKE :search')
            .orWhere('listing.externalSku ILIKE :search')
            .orWhere('listing.title ILIKE :search')
            .orWhere('listing.externalItemId ILIKE :search'),
        ),
      ).setParameter('search', `%${q.search}%`);
    if (q.productId) qb.andWhere('link.productId = :productId', q);
    if (q.productSku) qb.andWhere('product.sku = :productSku', q);
    if (q.marketplaceListingId)
      qb.andWhere('link.marketplaceListingId = :marketplaceListingId', q);
    if (q.connectionId) qb.andWhere('listing.connectionId = :connectionId', q);
    if (q.salesChannelId)
      qb.andWhere('listing.salesChannelId = :salesChannelId', q);
    if (q.channelCode) qb.andWhere('channel.code = :channelCode', q);
    if (q.status) qb.andWhere('link.status = :status', q);
    if (q.linkSource) qb.andWhere('link.linkSource = :linkSource', q);
    if (q.matchedByField)
      qb.andWhere('link.matchedByField = :matchedByField', q);
    if (q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo))
      throw new BadRequestException('Período inválido.');
    if (q.dateFrom)
      qb.andWhere('link.linkedAt >= :dateFrom', {
        dateFrom: new Date(q.dateFrom),
      });
    if (q.dateTo)
      qb.andWhere('link.linkedAt <= :dateTo', { dateTo: new Date(q.dateTo) });
    const sort = {
      linkedAt: 'link.linkedAt',
      updatedAt: 'link.updatedAt',
      productSku: 'product.sku',
      listingTitle: 'listing.title',
    } as const;
    const [entities, total] = await qb
      .orderBy(sort[q.sortBy], q.sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return this.page(
      entities.map((x) => this.view(x)),
      total,
      q.page,
      q.limit,
    );
  }

  async get(companyId: string, id: string) {
    const link = await this.linkQuery(this.links, companyId)
      .andWhere('link.id = :id', { id })
      .getOne();
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    const history = await this.audits.find({
      where: { companyId, linkId: id },
      order: { createdAt: 'DESC' },
    });
    return {
      ...this.view(link),
      history: history.map((x) => ({
        id: x.id,
        event: x.event,
        userId: x.userId,
        details: x.details,
        createdAt: x.createdAt,
      })),
    };
  }

  async productLinks(companyId: string, productId: string) {
    if (!(await this.products.existsBy({ id: productId, companyId })))
      throw new NotFoundException('Produto não encontrado.');
    const links = await this.linkQuery(this.links, companyId)
      .andWhere('link.productId = :productId', { productId })
      .orderBy('link.linkedAt', 'DESC')
      .getMany();
    return links.map((x) => this.view(x));
  }

  async unlinkedListings(
    companyId: string,
    q: ListUnlinkedMarketplaceListingsDto,
  ) {
    const qb = this.listings
      .createQueryBuilder('listing')
      .innerJoinAndSelect('listing.connection', 'connection')
      .innerJoinAndSelect('listing.channel', 'channel')
      .where('listing.companyId = :companyId', { companyId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM product_marketplace_links active_link WHERE active_link.company_id = :companyId AND active_link.marketplace_listing_id = listing.id AND active_link.status = 'ACTIVE')`,
      );
    if (q.connectionId) qb.andWhere('listing.connectionId = :connectionId', q);
    if (q.channelCode) qb.andWhere('channel.code = :channelCode', q);
    if (q.externalSku)
      qb.andWhere('listing.externalSku ILIKE :externalSku', {
        externalSku: `%${q.externalSku}%`,
      });
    if (q.status) qb.andWhere('listing.status = :status', q);
    if (q.withoutSku)
      qb.andWhere("NULLIF(BTRIM(listing.externalSku), '') IS NULL");
    if (q.search)
      qb.andWhere(
        '(listing.externalItemId ILIKE :search OR listing.externalSku ILIKE :search OR listing.title ILIKE :search)',
        { search: `%${q.search}%` },
      );
    const [listings, total] = await qb
      .orderBy('listing.lastSyncedAt', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    const data = await Promise.all(
      listings.map(async (listing) => ({
        listing: this.listingView(listing),
        suggestion: await this.suggestions.forListing(companyId, listing),
      })),
    );
    return this.page(
      q.withSuggestion ? data.filter((x) => x.suggestion) : data,
      total,
      q.page,
      q.limit,
    );
  }

  async listingSuggestions(companyId: string, listingId: string) {
    const listing = await this.listings.findOneBy({ id: listingId, companyId });
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    if (
      await this.links.existsBy({
        companyId,
        marketplaceListingId: listingId,
        status: ProductMarketplaceLinkStatus.ACTIVE,
      })
    )
      return [];
    const suggestion = await this.suggestions.forListing(companyId, listing);
    return suggestion ? [suggestion] : [];
  }

  async unlinkedProducts(companyId: string, q: ListUnlinkedProductsDto) {
    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.companyId = :companyId', { companyId })
      .andWhere((sub) => {
        const sq = sub
          .subQuery()
          .select('1')
          .from(ProductMarketplaceLink, 'link')
          .innerJoin(
            MarketplaceListing,
            'listing',
            'listing.id = link.marketplace_listing_id AND listing.company_id = link.company_id',
          )
          .innerJoin(
            SalesChannel,
            'channel',
            'channel.id = listing.sales_channel_id',
          )
          .where('link.company_id = :companyId')
          .andWhere('link.product_id = product.id')
          .andWhere("link.status = 'ACTIVE'");
        if (q.connectionId)
          sq.andWhere('listing.connection_id = :connectionId');
        if (q.salesChannelId)
          sq.andWhere('listing.sales_channel_id = :salesChannelId');
        if (q.channelCode) sq.andWhere('channel.code = :channelCode');
        return `NOT EXISTS ${sq.getQuery()}`;
      })
      .setParameters(q);
    if (q.search)
      qb.andWhere(
        '(product.sku ILIKE :search OR product.name ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${q.search}%` },
      );
    if (q.categoryId) qb.andWhere('product.categoryId = :categoryId', q);
    if (q.status) qb.andWhere('product.status = :status', q);
    const [data, total] = await qb
      .orderBy('product.name', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return this.page(
      data.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        salePrice: p.salePrice,
        status: p.status,
        category: p.category
          ? { id: p.category.id, name: p.category.name }
          : null,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  private async createWithOrigin(
    companyId: string,
    userId: string,
    dto: CreateProductMarketplaceLinkDto,
    idempotencyKey: string,
    origin: LinkOrigin,
  ) {
    this.key(idempotencyKey);
    const hash = this.hash({ action: 'create', dto, origin });
    try {
      return await this.db.transaction(async (m) => {
        const replay = await this.replay(m, companyId, idempotencyKey, hash);
        if (replay) return replay;
        const product = await m.findOneBy(Product, {
          id: dto.productId,
          companyId,
          status: ProductStatus.ACTIVE,
        });
        if (!product)
          throw new NotFoundException('Produto ativo não encontrado.');
        const listing = await m
          .getRepository(MarketplaceListing)
          .createQueryBuilder('listing')
          .setLock('pessimistic_write')
          .where('listing.id = :id AND listing.company_id = :companyId', {
            id: dto.marketplaceListingId,
            companyId,
          })
          .getOne();
        if (!listing) throw new NotFoundException('Anúncio não encontrado.');
        const connection = await m.findOneBy(SalesChannelConnection, {
          id: listing.connectionId,
          companyId,
          salesChannelId: listing.salesChannelId,
          status: SalesChannelConnectionStatus.CONNECTED,
        });
        if (!connection)
          throw new NotFoundException('Conexão ativa não encontrada.');
        if (['closed', 'deleted'].includes(listing.status.toLowerCase()))
          throw new ConflictException({
            code: 'MARKETPLACE_LISTING_INCOMPATIBLE',
            message: 'Este anúncio não está disponível para vinculação.',
          });
        if (
          await m.existsBy(ProductMarketplaceLink, {
            companyId,
            marketplaceListingId: listing.id,
            status: ProductMarketplaceLinkStatus.ACTIVE,
          })
        )
          this.linkedConflict();
        const link = await m.save(
          ProductMarketplaceLink,
          m.create(ProductMarketplaceLink, {
            companyId,
            productId: product.id,
            marketplaceListingId: listing.id,
            status: ProductMarketplaceLinkStatus.ACTIVE,
            linkSource: origin.source,
            matchConfidence: origin.confidence,
            matchedByField: origin.matchedBy,
            linkedByUserId: userId,
            unlinkedByUserId: null,
            linkedAt: new Date(),
            unlinkedAt: null,
            unlinkReason: null,
            lastValidatedAt: null,
            lastValidationStatus:
              ProductMarketplaceLinkValidationStatus.NOT_VALIDATED,
            lastValidationMessage: null,
          }),
        );
        const response = await this.viewByManager(m, companyId, link.id);
        await this.audit(m, {
          companyId,
          userId,
          link,
          event: origin.event,
          idempotencyKey,
          requestHash: hash,
          details: {
            source: origin.source,
            matchedBy: origin.matchedBy,
            confidence: origin.confidence,
            externalSku: listing.externalSku,
          },
          response,
        });
        return response;
      });
    } catch (error) {
      if (this.constraint(error) === 'UQ_pml_audit_idempotency') {
        const replay = await this.audits.findOneBy({
          companyId,
          idempotencyKey,
        });
        if (replay?.requestHash === hash && replay.response)
          return replay.response;
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key reutilizada com dados diferentes.',
        });
      }
      if (this.constraint(error) === 'UQ_pml_active_listing') {
        await this.recordConflict(companyId, userId, dto);
        this.linkedConflict();
      }
      if (this.errorCode(error) === 'MARKETPLACE_LISTING_ALREADY_LINKED')
        await this.recordConflict(companyId, userId, dto);
      throw error;
    }
  }

  private linkQuery(
    repository: Repository<ProductMarketplaceLink>,
    companyId: string,
  ) {
    return repository
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .innerJoinAndSelect('link.listing', 'listing')
      .innerJoinAndSelect('listing.connection', 'connection')
      .innerJoinAndSelect('listing.channel', 'channel')
      .innerJoinAndSelect('link.linkedBy', 'linkedBy')
      .leftJoinAndSelect('link.unlinkedBy', 'unlinkedBy')
      .where('link.companyId = :companyId', { companyId });
  }

  private async viewByManager(m: EntityManager, companyId: string, id: string) {
    const link = await this.linkQuery(
      m.getRepository(ProductMarketplaceLink),
      companyId,
    )
      .andWhere('link.id = :id', { id })
      .getOneOrFail();
    return this.view(link);
  }

  private view(link: ProductMarketplaceLink) {
    const listing = link.listing;
    return {
      id: link.id,
      status: link.status,
      linkSource: link.linkSource,
      matchedByField: link.matchedByField,
      matchConfidence: link.matchConfidence,
      linkedAt: link.linkedAt,
      unlinkedAt: link.unlinkedAt,
      unlinkReason: link.unlinkReason,
      lastValidation: {
        at: link.lastValidatedAt,
        status: link.lastValidationStatus,
        message: link.lastValidationMessage,
      },
      product: {
        id: link.product.id,
        sku: link.product.sku,
        name: link.product.name,
        salePrice: link.product.salePrice,
        status: link.product.status,
      },
      listing: this.listingView(listing),
      channel: {
        id: listing.channel.id,
        code: listing.channel.code,
        name: listing.channel.name,
      },
      connection: {
        id: listing.connection.id,
        name: listing.connection.displayName,
        status: listing.connection.status,
      },
      linkedBy: { id: link.linkedBy.id, name: link.linkedBy.name },
      unlinkedBy: link.unlinkedBy
        ? { id: link.unlinkedBy.id, name: link.unlinkedBy.name }
        : null,
    };
  }

  private listingView(listing: MarketplaceListing) {
    return {
      id: listing.id,
      externalItemId: listing.externalItemId,
      externalVariationId: listing.externalVariationId,
      externalSku: listing.externalSku,
      title: listing.title,
      thumbnailUrl: listing.thumbnailUrl,
      price: String(listing.price),
      currency: listing.currency,
      availableQuantity: listing.availableQuantity,
      status: listing.status,
      lastSyncedAt: listing.lastSyncedAt,
      channel: listing.channel
        ? {
            id: listing.channel.id,
            code: listing.channel.code,
            name: listing.channel.name,
          }
        : undefined,
      connection: listing.connection
        ? { id: listing.connection.id, name: listing.connection.displayName }
        : undefined,
    };
  }

  private async audit(
    m: EntityManager,
    input: {
      companyId: string;
      userId: string;
      link: ProductMarketplaceLink;
      event: ProductMarketplaceLinkEvent;
      idempotencyKey: string;
      requestHash: string;
      details: Record<string, unknown>;
      response: Record<string, unknown>;
    },
  ) {
    const listing = await m.findOneByOrFail(MarketplaceListing, {
      id: input.link.marketplaceListingId,
      companyId: input.companyId,
    });
    const channel = await m.findOneByOrFail(SalesChannel, {
      id: listing.salesChannelId,
    });
    await m.save(
      ProductMarketplaceLinkAudit,
      m.create(ProductMarketplaceLinkAudit, {
        companyId: input.companyId,
        linkId: input.link.id,
        productId: input.link.productId,
        marketplaceListingId: input.link.marketplaceListingId,
        connectionId: listing.connectionId,
        channelCode: channel.code,
        userId: input.userId,
        event: input.event,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        details: input.details,
        response: input.response,
      }),
    );
    this.logger.log({
      event: input.event,
      companyId: input.companyId,
      productId: input.link.productId,
      listingId: input.link.marketplaceListingId,
      connectionId: listing.connectionId,
      channelCode: channel.code,
      userId: input.userId,
    });
  }

  private async replay(
    m: EntityManager,
    companyId: string,
    key: string,
    hash: string,
  ) {
    const audit = await m.findOneBy(ProductMarketplaceLinkAudit, {
      companyId,
      idempotencyKey: key,
    });
    if (!audit) return null;
    if (audit.requestHash !== hash)
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key reutilizada com dados diferentes.',
      });
    return audit.response;
  }
  private async idempotencyRace(
    error: unknown,
    companyId: string,
    idempotencyKey: string,
    hash: string,
  ) {
    if (this.constraint(error) !== 'UQ_pml_audit_idempotency') throw error;
    const replay = await this.audits.findOneBy({ companyId, idempotencyKey });
    if (replay?.requestHash === hash && replay.response) return replay.response;
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'Idempotency-Key reutilizada com dados diferentes.',
    });
  }

  private key(value: string) {
    if (!value?.trim())
      throw new BadRequestException('Idempotency-Key é obrigatório.');
    if (value.length > 160)
      throw new BadRequestException(
        'Idempotency-Key excede o limite permitido.',
      );
  }
  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
  private linkedConflict(): never {
    throw new ConflictException({
      code: 'MARKETPLACE_LISTING_ALREADY_LINKED',
      message: 'Este anúncio já está vinculado a outro produto.',
    });
  }
  private constraint(error: unknown) {
    if (!(error instanceof QueryFailedError)) return null;
    const driver = error.driverError as { code?: string; constraint?: string };
    return driver.code === '23505' ? (driver.constraint ?? null) : null;
  }
  private async recordConflict(
    companyId: string,
    userId: string,
    dto: CreateProductMarketplaceLinkDto,
  ) {
    const listing = await this.listings.findOne({
      where: { id: dto.marketplaceListingId, companyId },
      relations: { channel: true },
    });
    await this.audits.save(
      this.audits.create({
        companyId,
        linkId: null,
        productId: dto.productId,
        marketplaceListingId: dto.marketplaceListingId,
        connectionId: listing?.connectionId ?? null,
        channelCode: listing?.channel?.code ?? null,
        userId,
        event: ProductMarketplaceLinkEvent.LINK_CONFLICT,
        idempotencyKey: null,
        requestHash: null,
        details: { reason: 'MARKETPLACE_LISTING_ALREADY_LINKED' },
        response: null,
      }),
    );
  }
  private errorCode(error: unknown) {
    if (typeof error === 'object' && error && 'response' in error) {
      const response = (error as { response?: unknown }).response;
      if (typeof response === 'object' && response && 'code' in response)
        return String(response.code);
    }
    return 'LINK_FAILED';
  }
  private page<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
