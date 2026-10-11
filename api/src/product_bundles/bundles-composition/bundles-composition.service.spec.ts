import { DataSource } from 'typeorm';
import { BundlesCompositionService } from './bundles-composition.service';
import { Product } from '../../products/entities/product.entity';
import { ProductBundle } from '../entities/product_bundle.entity';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
function setup() {
  const products = [
    { id: 'x', companyId: 'c', status: 'ACTIVE' },
    { id: 'y', companyId: 'c', status: 'ACTIVE' },
    { id: 'kit', companyId: 'c', status: 'ACTIVE' },
    { id: 'nested', companyId: 'c', status: 'ACTIVE' },
    { id: 'foreign', companyId: 'other', status: 'ACTIVE' },
  ];
  const bundles = [
    { id: 'b', bundleProductId: 'kit', companyId: 'c', active: true },
  ];
  const components = [
    {
      id: 'cx',
      bundleId: 'b',
      companyId: 'c',
      componentProductId: 'x',
      quantity: 6,
      active: true,
    },
  ];
  const balances = [
    {
      productId: 'x',
      companyId: 'c',
      currentQuantity: '25.000',
      reservedQuantity: '0.000',
    },
    {
      productId: 'y',
      companyId: 'c',
      currentQuantity: '7.000',
      reservedQuantity: '0.000',
    },
  ];
  const matching = (
    record: Record<string, unknown>,
    where: Record<string, unknown>,
  ) => Object.entries(where).every(([key, value]) => record[key] === value);
  const manager = {
    findOneBy: jest.fn((entity: unknown, where: Record<string, unknown>) => {
      const data =
        entity === Product
          ? products
          : entity === ProductBundle
            ? bundles
            : entity === InventoryBalance
              ? balances
              : components;
      return Promise.resolve(data.find((row) => matching(row, where)) ?? null);
    }),
    findBy: jest.fn((_entity: unknown, where: Record<string, unknown>) =>
      Promise.resolve(components.filter((row) => matching(row, where))),
    ),
  };
  return {
    service: new BundlesCompositionService({
      manager,
    } as unknown as DataSource),
    products,
    bundles,
    components,
    balances,
  };
}
describe('bundle composition', () => {
  it('unit product keeps its quantity', async () => {
    const { service } = setup();
    expect(await service.expandBundleComponents('x', '1', 'c')).toEqual([
      { productId: 'x', quantity: '1.000' },
    ]);
  });
  it.each([
    ['1', '6.000'],
    ['2', '12.000'],
  ])('expands %s kits to %s units', async (sold, expected) => {
    const { service } = setup();
    expect(await service.expandBundleComponents('kit', sold, 'c')).toEqual([
      { productId: 'x', quantity: expected },
    ]);
  });
  it('expands multiple components', async () => {
    const s = setup();
    s.components[0].quantity = 2;
    s.components.push({
      id: 'cy',
      bundleId: 'b',
      companyId: 'c',
      componentProductId: 'y',
      quantity: 3,
      active: true,
    });
    expect(await s.service.expandBundleComponents('kit', '2', 'c')).toEqual([
      { productId: 'x', quantity: '4.000' },
      { productId: 'y', quantity: '6.000' },
    ]);
  });
  it('consolidates repeated leaves of nested kits', async () => {
    const s = setup();
    s.bundles.push({
      id: 'n',
      bundleProductId: 'nested',
      companyId: 'c',
      active: true,
    });
    s.components.push(
      {
        id: 'cn',
        bundleId: 'b',
        companyId: 'c',
        componentProductId: 'nested',
        quantity: 1,
        active: true,
      },
      {
        id: 'nx',
        bundleId: 'n',
        companyId: 'c',
        componentProductId: 'x',
        quantity: 3,
        active: true,
      },
    );
    expect(await s.service.expandBundleComponents('kit', '1', 'c')).toEqual([
      { productId: 'x', quantity: '9.000' },
    ]);
  });
  it('uses floor 25/6=4', async () => {
    const { service } = setup();
    expect(await service.calculateMaxAvaliableKits('kit', 'c')).toBe(4);
  });
  it('uses the limiting component', async () => {
    const s = setup();
    s.components[0].quantity = 2;
    s.components.push({
      id: 'cy',
      bundleId: 'b',
      companyId: 'c',
      componentProductId: 'y',
      quantity: 3,
      active: true,
    });
    expect(await s.service.calculateMaxAvaliableKits('kit', 'c')).toBe(2);
  });
  it('subtracts reserved stock', async () => {
    const s = setup();
    s.balances[0].reservedQuantity = '7.000';
    expect(await s.service.calculateMaxAvaliableKits('kit', 'c')).toBe(3);
  });
  it('rejects circular composition', async () => {
    const s = setup();
    s.components[0].componentProductId = 'kit';
    await expect(
      s.service.expandBundleComponents('kit', '1', 'c'),
    ).rejects.toThrow('ciclo');
    expect(await s.service.detectCycle('kit', 'kit', 'c')).toBe(true);
  });
  it('rejects products from a different company', async () => {
    const s = setup();
    s.components[0].componentProductId = 'foreign';
    await expect(
      s.service.expandBundleComponents('kit', '1', 'c'),
    ).rejects.toThrow('empresa');
  });
  it('rejects empty kits instead of reserving nothing', async () => {
    const s = setup();
    s.components.length = 0;
    await expect(
      s.service.expandBundleComponents('kit', '1', 'c'),
    ).rejects.toThrow('componente');
  });
  it.each(['0', '-1', 'NaN', '1.0001'])(
    'rejects invalid quantity %s',
    async (q) => {
      await expect(
        setup().service.expandBundleComponents('kit', q, 'c'),
      ).rejects.toThrow();
    },
  );
});
