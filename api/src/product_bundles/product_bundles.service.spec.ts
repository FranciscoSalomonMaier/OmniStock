import { ProductBundlesService } from './product_bundles.service';
import { DataSource } from 'typeorm';
import { BundlesCompositionService } from './bundles-composition/bundles-composition.service';
describe('bundle creation', () => {
  it('checks the product in the requesting company before creating a bundle', async () => {
    const composition = {
      lock: jest.fn(),
      product: jest.fn().mockRejectedValue(new Error('empresa')),
    };
    const db = {
      transaction: async (fn: (m: unknown) => Promise<unknown>) => fn({}),
    };
    const s = new ProductBundlesService(
      db as unknown as DataSource,
      composition as unknown as BundlesCompositionService,
    );
    await expect(
      s.create('company', { bundleProductId: 'foreign' }),
    ).rejects.toThrow('empresa');
    expect(composition.product).toHaveBeenCalledWith('company', 'foreign', {});
  });
});
