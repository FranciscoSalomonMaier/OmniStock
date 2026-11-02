import { ProductsService } from './products.service';
import { CompanyRole } from '../common/enums/company-role.enum';
import { UnitOfMeasure } from './enums/product.enums';

describe('Product purchase and cost prices', () => {
  const product = {
    id: 'product',
    sku: 'SKU',
    purchasePrice: '2.00',
    costPrice: '2.50',
    salePrice: '19.90',
  };
  function setup() {
    const products = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn(async (value: unknown) => value),
      findOne: jest.fn().mockResolvedValue({ ...product }),
    };
    const args = [
      products,
      {},
      {},
      {},
      {},
      { describe: async () => ({}) },
    ] as unknown as ConstructorParameters<typeof ProductsService>;
    return { service: new ProductsService(...args), products };
  }
  it('persists purchase and total cost separately without a selling price', async () => {
    const { service, products } = setup();
    await service.create('company', 'user', {
      sku: 'SKU',
      name: 'Produto',
      unitOfMeasure: UnitOfMeasure.UN,
      minimumStock: '0',
      purchasePrice: '2.00',
      costPrice: '2.50',
    });
    expect(products.save).toHaveBeenCalledWith(
      expect.objectContaining({
        purchasePrice: '2.00',
        costPrice: '2.50',
        salePrice: null,
      }),
    );
  });
  it('updates purchase without overwriting total cost or historical selling price', async () => {
    const { service } = setup();
    await expect(
      service.update('company', 'product', 'user', { purchasePrice: '3.00' }),
    ).resolves.toMatchObject({
      purchasePrice: '3.00',
      costPrice: '2.50',
      salePrice: '19.90',
    });
  });
  it.each([CompanyRole.SUPPORT, CompanyRole.VIEWER])(
    'hides both prices from %s',
    async (role) => {
      const { service } = setup();
      const result = await service.get('company', 'product', role);
      expect(result).not.toHaveProperty('purchasePrice');
      expect(result).not.toHaveProperty('costPrice');
    },
  );
  it('returns both prices to administrators', async () => {
    const { service } = setup();
    await expect(
      service.get('company', 'product', CompanyRole.ADMIN),
    ).resolves.toMatchObject({ purchasePrice: '2.00', costPrice: '2.50' });
  });
});
