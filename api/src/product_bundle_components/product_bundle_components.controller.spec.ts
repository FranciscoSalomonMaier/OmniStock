import { ProductBundleComponentsController } from './product_bundle_components.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
describe('ProductBundleComponentsController authorization', () => {
  it('requires JWT, company context and company role guards', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProductBundleComponentsController),
    ).toHaveLength(3);
  });
});
