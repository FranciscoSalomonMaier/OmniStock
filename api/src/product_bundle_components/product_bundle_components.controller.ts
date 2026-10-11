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
import { ProductBundleComponentsService } from './product_bundle_components.service';
import { CreateProductBundleComponentDto } from './dto/create-product_bundle_component.dto';
import { UpdateProductBundleComponentDto } from './dto/update-product_bundle_component.dto';
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('products')
export class ProductBundleComponentsController {
  constructor(private service: ProductBundleComponentsService) {}
  @Get(':productId/bundle-components') get(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) p: string,
  ) {
    return this.service.findAllForProduct(m.companyId, p);
  }
  @Post(':productId/bundle-components')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  create(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) p: string,
    @Body() dto: CreateProductBundleComponentDto,
  ) {
    return this.service.createForProduct(m.companyId, p, dto);
  }
  @Patch(':productId/bundle-components/:componentId')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  update(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) p: string,
    @Param('componentId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductBundleComponentDto,
  ) {
    return this.service.update(m.companyId, p, id, dto);
  }
  @Delete(':productId/bundle-components/:componentId')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  remove(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) p: string,
    @Param('componentId', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(m.companyId, p, id);
  }
}
