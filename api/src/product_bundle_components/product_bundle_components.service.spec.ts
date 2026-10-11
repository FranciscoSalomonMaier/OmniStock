import { ProductBundleComponentsService } from './product_bundle_components.service';
import { DataSource } from 'typeorm';
import { BundlesCompositionService } from '../product_bundles/bundles-composition/bundles-composition.service';
describe('component mutation scope', () => {
  it('matches both active company and parent kit before updating', async () => {
    const findOneBy = jest.fn().mockResolvedValue(null);
    const manager = { findOneBy };
    const db = {
      transaction: async (fn: (m: unknown) => Promise<unknown>) => fn(manager),
    };
    const composition = {
      lock: jest.fn(),
      getActiveBundleForProduct: jest
        .fn()
        .mockResolvedValue({ id: 'correct-kit' }),
    };
    const s = new ProductBundleComponentsService(
      db as unknown as DataSource,
      composition as unknown as BundlesCompositionService,
    );
    await expect(
      s.update('company', 'product', 'foreign-component', { quantity: 6 }),
    ).rejects.toThrow('não pertence');
    expect(findOneBy).toHaveBeenCalledWith(expect.anything(), {
      companyId: 'company',
      bundleId: 'correct-kit',
      id: 'foreign-component',
      active: true,
    });
  });
});
