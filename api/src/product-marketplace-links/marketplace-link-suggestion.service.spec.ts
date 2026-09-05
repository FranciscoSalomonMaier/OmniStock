import { Repository } from 'typeorm';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product.enums';
import { ProductMarketplaceMatchedByField } from './enums/product-marketplace-link.enums';
import { MarketplaceLinkSuggestionService } from './marketplace-link-suggestion.service';

describe('MarketplaceLinkSuggestionService', () => {
  const candidates: Product[] = [];
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(() => Promise.resolve(candidates)),
  };
  const createQueryBuilder = jest.fn(() => qb);
  const repository = {
    createQueryBuilder,
  } as unknown as Repository<Product>;
  const service = new MarketplaceLinkSuggestionService(repository);
  const listing = { externalSku: ' mk001 ' } as MarketplaceListing;

  beforeEach(() => {
    candidates.splice(0);
    jest.clearAllMocks();
  });

  it('sugere somente uma correspondência exata e ativa', async () => {
    candidates.push({
      id: 'product-id',
      sku: 'MK001',
      name: 'Produto',
      status: ProductStatus.ACTIVE,
    } as Product);
    await expect(service.forListing('company-id', listing)).resolves.toEqual({
      productId: 'product-id',
      sku: 'MK001',
      name: 'Produto',
      matchedBy: ProductMarketplaceMatchedByField.SKU,
      confidence: 1,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('product.status = :status', {
      status: ProductStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'UPPER(BTRIM(product.sku)) = :sku',
      { sku: 'MK001' },
    );
  });

  it('não sugere SKU vazio', async () => {
    await expect(
      service.forListing('company-id', {
        externalSku: ' ',
      } as MarketplaceListing),
    ).resolves.toBeNull();
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('não sugere quando a correspondência é ambígua', async () => {
    candidates.push(
      { id: 'a', sku: 'MK001' } as Product,
      { id: 'b', sku: 'MK001' } as Product,
    );
    await expect(service.forListing('company-id', listing)).resolves.toBeNull();
  });
});
