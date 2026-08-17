import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CompanyMember } from '../entities/company-member.entity';
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CompanyMember =>
    context.switchToHttp().getRequest<{ membership: CompanyMember }>()
      .membership,
);
