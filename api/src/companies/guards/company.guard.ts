import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CompaniesService } from '../companies.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private readonly companies: CompaniesService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      user: User;
      membership?: unknown;
    }>();
    const companyId = request.headers['x-company-id'];
    if (!companyId)
      throw new BadRequestException('O header X-Company-Id é obrigatório');
    if (!isUUID(companyId))
      throw new BadRequestException('X-Company-Id inválido');
    if (request.params.companyId && request.params.companyId !== companyId)
      throw new ForbiddenException('Acesso negado');
    const membership = await this.companies.activeMembership(
      companyId,
      request.user.id,
    );
    if (!membership) throw new ForbiddenException('Acesso negado');
    request.membership = membership;
    return true;
  }
}
