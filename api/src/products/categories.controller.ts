import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
@ApiTags('Product Categories')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('product-categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}
  @Post() @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER) create(
    @CurrentMembership() m: CompanyMember,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.service.create(m.companyId, dto);
  }
  @Get() list(@CurrentMembership() m: CompanyMember) {
    return this.service.list(m.companyId);
  }
  @Get(':id') get(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.service.get(m.companyId, id);
  }
  @Patch(':id') @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER) update(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(m.companyId, id, dto);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  async remove(@CurrentMembership() m: CompanyMember, @Param('id') id: string) {
    await this.service.deactivate(m.companyId, id);
  }
}
