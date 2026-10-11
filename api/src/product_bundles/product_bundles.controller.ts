import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyRole } from '../common/enums/company-role.enum';
import { ProductBundlesService } from './product_bundles.service';
import { CreateProductBundleDto } from './dto/create-product_bundle.dto';
import { UpdateProductBundleDto } from './dto/update-product_bundle.dto';
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('product-bundles')
export class ProductBundlesController {
  constructor(private service: ProductBundlesService) {}
  @Post()
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  create(
    @CurrentMembership() m: CompanyMember,
    @Body() dto: CreateProductBundleDto,
  ) {
    return this.service.create(m.companyId, dto);
  }
  @Get() list(@CurrentMembership() m: CompanyMember) {
    return this.service.findAll(m.companyId);
  }
  @Get(':id') get(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(m.companyId, id);
  }
  @Patch(':id')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  update(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductBundleDto,
  ) {
    return this.service.update(m.companyId, id, dto);
  }
  @Delete(':id')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  remove(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(m.companyId, id);
  }
}
