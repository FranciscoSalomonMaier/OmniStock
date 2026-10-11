import { ProductBundlesController } from './product_bundles.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
describe('ProductBundlesController authorization', () => {
  it('requires JWT, company context and company role guards', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProductBundlesController),
    ).toHaveLength(3);
  });
});
