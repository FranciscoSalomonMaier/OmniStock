import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import { User } from '../users/entities/user.entity';
import { CreateKitDto, UpdateKitDto } from './dto/kit.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('kits')
export class KitsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  create(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: CreateKitDto,
  ) {
    return this.products.createKit(m.companyId, u.id, dto);
  }

  @Patch(':id')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  update(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKitDto,
  ) {
    return this.products.updateKit(m.companyId, id, u.id, dto);
  }
}
