/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { ProductStatus, UnitOfMeasure } from './enums/product.enums';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductBundle } from '../product_bundles/entities/product_bundle.entity';
import { ProductBundleComponent } from '../product_bundle_components/entities/product_bundle_component.entity';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateKitDto } from './dto/kit.dto';

describe('Separate product and kit registration', () => {
  const componentId = '7a55f329-e994-48fa-a8e6-b16f2370b661';
  function setup() {
    const saves: unknown[] = [];
    const manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) => {
        saves.push([entity, value]);
        if (entity === Product) return { ...value, id: 'new-kit' };
        if (entity === ProductBundle) return { ...value, id: 'new-bundle' };
        return value;
      }),
    };
    const products = {
      create: jest.fn((value) => value),
      manager: { transaction: jest.fn(async (callback) => callback(manager)) },
    };
    const bundles = {
      lock: jest.fn(),
      product: jest.fn(async () => ({
        id: componentId,
        status: ProductStatus.ACTIVE,
      })),
      validateComposition: jest.fn(async () => true),
      queueChanges: jest.fn(),
    };
    const service = new ProductsService(
      products as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      bundles as never,
    );
    return { service, products, bundles, manager, saves };
  }

  it('creates the kit and its components in one transaction', async () => {
    const { service, products, bundles, manager } = setup();
    await expect(
      service.createKit('company', 'user', {
        sku: 'KIT001',
        name: 'Kit teste',
        minimumStock: '0',
        components: [{ productId: componentId, quantity: 3 }],
      }),
    ).resolves.toMatchObject({
      id: 'new-kit',
      unitOfMeasure: UnitOfMeasure.KIT,
    });
    expect(products.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(ProductBundleComponent, [
      expect.objectContaining({
        bundleId: 'new-bundle',
        componentProductId: componentId,
        quantity: 3,
      }),
    ]);
    expect(bundles.queueChanges).toHaveBeenCalledWith(
      'company',
      'new-kit',
      manager,
      true,
    );
  });

  it('rejects an empty or repeated composition before writing', async () => {
    const { service, products } = setup();
    for (const components of [
      [],
      [
        { productId: componentId, quantity: 1 },
        { productId: componentId, quantity: 2 },
      ],
    ]) {
      await expect(
        service.createKit('company', 'user', {
          sku: 'KIT001',
          name: 'Kit teste',
          minimumStock: '0',
          components,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(products.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid nested kits before saving the new product', async () => {
    const { service, bundles, manager } = setup();
    bundles.validateComposition.mockResolvedValue(false);
    await expect(
      service.createKit('company', 'user', {
        sku: 'KIT001',
        name: 'Kit teste',
        minimumStock: '0',
        components: [{ productId: componentId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects KIT as a unit in the product registration endpoint', async () => {
    const { service, products } = setup();
    await expect(
      service.create('company', 'user', {
        sku: 'KIT001',
        name: 'Kit teste',
        minimumStock: '0',
        unitOfMeasure: UnitOfMeasure.KIT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('validates nested component quantities and forbids a supplied unit', async () => {
    const dto = plainToInstance(CreateKitDto, {
      sku: 'KIT001',
      name: 'Kit teste',
      minimumStock: '0',
      components: [{ productId: componentId, quantity: 0 }],
      unitOfMeasure: 'UN',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toContain('unitOfMeasure');
    expect(
      errors.find((error) => error.property === 'components')?.children,
    ).toHaveLength(1);
  });
});
