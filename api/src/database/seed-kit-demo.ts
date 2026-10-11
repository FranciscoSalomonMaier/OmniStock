import { Company } from '../companies/entities/company.entity';
import { ProductBundleComponent } from '../product_bundle_components/entities/product_bundle_component.entity';
import { ProductBundle } from '../product_bundles/entities/product_bundle.entity';
import { Product } from '../products/entities/product.entity';
import { ProductStatus, UnitOfMeasure } from '../products/enums/product.enums';
import dataSource from './data-source';

async function seedKitDemo() {
  await dataSource.initialize();

  const companies = dataSource.getRepository(Company);
  let company = await companies.findOne({
    where: { document: '00000000000000' },
  });

  if (!company) {
    company = await companies.save(
      companies.create({
        legalName: 'OmniStock Desenvolvimento LTDA',
        tradeName: 'OmniStock Desenvolvimento',
        document: '00000000000000',
      }),
    );
  }

  const companyId = company.id;
  const productRepo = dataSource.getRepository(Product);
  const bundleRepo = dataSource.getRepository(ProductBundle);
  const bundleComponentRepo = dataSource.getRepository(ProductBundleComponent);

  let productX = await productRepo.findOne({
    where: { companyId, sku: 'PROD-X' },
  });

  if (!productX) {
    productX = await productRepo.save(
      productRepo.create({
        companyId,
        sku: 'PROD-X',
        name: 'ProdutoX',
        salePrice: '100.00',
        unitOfMeasure: UnitOfMeasure.UN,
        status: ProductStatus.ACTIVE,
      }),
    );
  }

  let kitProduct = await productRepo.findOne({
    where: { companyId, sku: 'KIT-PROD-X-6' },
  });

  if (!kitProduct) {
    kitProduct = await productRepo.save(
      productRepo.create({
        companyId,
        sku: 'KIT-PROD-X-6',
        name: 'Kit ProdutoX 6',
        salePrice: '0.00',
        unitOfMeasure: UnitOfMeasure.UN,
        status: ProductStatus.ACTIVE,
      }),
    );
  }

  let bundle = await bundleRepo.findOne({
    where: { companyId, bundleProductId: kitProduct.id },
  });

  if (!bundle) {
    bundle = await bundleRepo.save(
      bundleRepo.create({
        companyId,
        bundleProductId: kitProduct.id,
        active: true,
      }),
    );
  }

  const existingComponent = await bundleComponentRepo.findOne({
    where: {
      companyId,
      bundleId: bundle.id,
      componentProductId: productX.id,
    },
  });

  if (!existingComponent) {
    await bundleComponentRepo.save(
      bundleComponentRepo.create({
        companyId,
        bundleId: bundle.id,
        componentProductId: productX.id,
        quantity: 6,
        active: true,
      }),
    );
  } else if (existingComponent.quantity !== 6) {
    existingComponent.quantity = 6;
    await bundleComponentRepo.save(existingComponent);
  }

  console.log('Seed do kit criado com sucesso.');
  await dataSource.destroy();
}

seedKitDemo().catch((error) => {
  console.error('Erro ao criar seed do kit:', error);
  process.exit(1);
});