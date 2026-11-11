import { DataSource, EntityManager } from 'typeorm';
import { BundlesCompositionService } from '../product_bundles/bundles-composition/bundles-composition.service';
import { LocalStorageService } from './storage/local-storage.service';
import { ProductRemovalService } from './product-removal.service';

describe('ProductRemovalService reasons', () => {
  const companyId = 'company-id';
  const productId = 'product-id';

  function setup(kitRows: unknown[], usage?: Record<string, boolean>) {
    const manager = {
      findOneBy: jest.fn().mockResolvedValue({ id: productId, companyId }),
      query: jest
        .fn()
        .mockResolvedValueOnce(kitRows)
        .mockResolvedValueOnce(usage ? [usage] : []),
    } as unknown as EntityManager;
    const service = new ProductRemovalService(
      { manager } as DataSource,
      {} as BundlesCompositionService,
      {} as LocalStorageService,
    );
    return { service, manager };
  }

  it('reports every applicable category, including fiscal links', async () => {
    const { service } = setup([], {
      stock: true,
      stockHistory: false,
      orderHistory: true,
      marketplaceLink: false,
      syncHistory: false,
      fiscalLink: true,
      pendingProcessing: false,
    });
    await expect(service.check(companyId, productId)).resolves.toMatchObject({
      allowed: false,
      reason: 'HAS_DEPENDENCIES',
      reasons: [
        'Possui estoque',
        'Possui histórico de pedidos',
        'Vínculo fiscal',
      ],
    });
  });

  it('keeps the linked kits available for the warning', async () => {
    const kit = { id: 'kit-id', sku: 'KIT3', name: 'Kit de três' };
    const { service } = setup([kit]);
    await expect(service.check(companyId, productId)).resolves.toMatchObject({
      allowed: false,
      reason: 'USED_IN_KITS',
      reasons: ['Vinculado a kits'],
      kits: [kit],
    });
  });
});
