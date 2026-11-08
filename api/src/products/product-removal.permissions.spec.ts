import 'reflect-metadata';
import { ProductsController } from './products.controller';
import { COMPANY_ROLES_KEY } from '../companies/decorators/company-roles.decorator';
import { CompanyRole } from '../common/enums/company-role.enum';

describe('Product removal permissions', () => {
  it.each(['removalCheck', 'removeProduct'] as const)(
    'restricts %s to product writers',
    (method) => {
      const roles = Reflect.getMetadata(
        COMPANY_ROLES_KEY,
        Object.getOwnPropertyDescriptor(ProductsController.prototype, method)
          ?.value as object,
      ) as CompanyRole[];
      expect(roles).toEqual([
        CompanyRole.ADMIN,
        CompanyRole.MANAGER,
        CompanyRole.STOCKIST,
      ]);
      expect(roles).not.toContain(CompanyRole.VIEWER);
      expect(roles).not.toContain(CompanyRole.SUPPORT);
    },
  );
});
