import { SetMetadata } from '@nestjs/common';
import { CompanyRole } from '../../common/enums/company-role.enum';
export const COMPANY_ROLES_KEY = 'companyRoles';
export const CompanyRoles = (...roles: CompanyRole[]) =>
  SetMetadata(COMPANY_ROLES_KEY, roles);
