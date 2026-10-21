import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { CompanyMember } from '../companies/entities/company-member.entity';
export const FISCAL_PERMISSIONS = [
  'fiscal.establishments.read',
  'fiscal.establishments.manage',
  'fiscal.document_settings.read',
  'fiscal.document_settings.manage',
  'fiscal.document_settings.change_number',
  'fiscal.products.read',
  'fiscal.products.manage',
  'fiscal.tax_rules.read',
  'fiscal.tax_rules.manage',
  'fiscal.review.submit',
  'fiscal.review.approve',
  'fiscal.audit.read',
] as const;
export type FiscalPermission = (typeof FISCAL_PERMISSIONS)[number];
export const RequireFiscalPermission = (p: FiscalPermission) =>
  SetMetadata('fiscalPermission', p);
export function defaultFiscalPermission(role: string, p: FiscalPermission) {
  if (role === 'ADMIN') return true;
  if (['MANAGER', 'BILLING'].includes(role))
    return ![
      'fiscal.review.approve',
      'fiscal.document_settings.change_number',
    ].includes(p);
  if (role === 'STOCKIST') return p === 'fiscal.products.read';
  return p.endsWith('.read');
}
@Injectable()
export class FiscalPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: DataSource,
  ) {}
  async permissions(m: CompanyMember) {
    const overrides = await this.db.query<
      Array<{ permission: string; allowed: boolean }>
    >(
      'SELECT permission,allowed FROM fiscal_permission_overrides WHERE company_id=$1 AND user_id=$2',
      [m.companyId, m.userId],
    );
    return FISCAL_PERMISSIONS.filter(
      (p) =>
        overrides.find((o) => o.permission === p)?.allowed ??
        defaultFiscalPermission(m.role, p),
    );
  }
  async canActivate(c: ExecutionContext) {
    const p = this.reflector.getAllAndOverride<FiscalPermission>(
      'fiscalPermission',
      [c.getHandler(), c.getClass()],
    );
    const m = c
      .switchToHttp()
      .getRequest<{ membership: CompanyMember }>().membership;
    if (!m || !p || !(await this.permissions(m)).includes(p))
      throw new ForbiddenException('Permissão fiscal insuficiente.');
    return true;
  }
}
