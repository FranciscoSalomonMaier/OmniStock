import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { COMPANY_ROLES_KEY } from '../decorators/company-roles.decorator';
import { CompanyMember } from '../entities/company-member.entity';
@Injectable()
export class CompanyRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<CompanyRole[]>(
      COMPANY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const membership = context
      .switchToHttp()
      .getRequest<{ membership?: CompanyMember }>().membership;
    if (!membership || !roles.includes(membership.role))
      throw new ForbiddenException(
        'Você não possui permissão para esta operação',
      );
    return true;
  }
}
