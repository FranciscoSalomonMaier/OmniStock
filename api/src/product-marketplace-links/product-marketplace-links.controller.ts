import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import { User } from '../users/entities/user.entity';
import {
  AcceptMarketplaceLinkSuggestionDto,
  BulkProductMarketplaceLinksDto,
  CreateProductMarketplaceLinkDto,
  ListProductMarketplaceLinksDto,
  ListUnlinkedMarketplaceListingsDto,
  ListUnlinkedProductsDto,
  ProductMarketplaceLinkResponseDto,
  UnlinkProductMarketplaceLinkDto,
} from './dto/product-marketplace-link.dto';
import { ProductMarketplaceLinksService } from './product-marketplace-links.service';

const writeRoles = [
  CompanyRole.ADMIN,
  CompanyRole.MANAGER,
  CompanyRole.STOCKIST,
];
const manageRoles = [CompanyRole.ADMIN, CompanyRole.MANAGER];

@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@ApiTags('Product marketplace links')
@Controller('product-marketplace-links')
export class ProductMarketplaceLinksController {
  constructor(private readonly service: ProductMarketplaceLinksService) {}

  @Post()
  @CompanyRoles(...writeRoles)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Vincula manualmente um produto a um anúncio ou variação',
  })
  @ApiOkResponse({ type: ProductMarketplaceLinkResponseDto })
  @ApiConflictResponse({ description: 'MARKETPLACE_LISTING_ALREADY_LINKED' })
  create(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: CreateProductMarketplaceLinkDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.create(m.companyId, u.id, dto, key);
  }

  @Get()
  list(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListProductMarketplaceLinksDto,
  ) {
    return this.service.list(m.companyId, q);
  }

  @Post('bulk')
  @CompanyRoles(...manageRoles)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Cria até 50 vínculos, retornando o resultado por item',
  })
  bulk(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: BulkProductMarketplaceLinksDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.bulk(m.companyId, u.id, dto, key);
  }

  @Get(':id')
  get(@CurrentMembership() m: CompanyMember, @Param('id') id: string) {
    return this.service.get(m.companyId, id);
  }

  @Post(':id/unlink')
  @CompanyRoles(...manageRoles)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Desvincula sem excluir o histórico' })
  unlink(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() dto: UnlinkProductMarketplaceLinkDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.unlink(m.companyId, u.id, id, dto.reason, key);
  }

  @Post(':id/validate')
  @CompanyRoles(...writeRoles)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  validate(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.validate(m.companyId, u.id, id, key);
  }
}

@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@ApiTags('Marketplace listings links')
@Controller('marketplace-listings')
export class MarketplaceListingsLinksController {
  constructor(private readonly service: ProductMarketplaceLinksService) {}

  @Get('unlinked')
  unlinked(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListUnlinkedMarketplaceListingsDto,
  ) {
    return this.service.unlinkedListings(m.companyId, q);
  }

  @Get(':id/link-suggestions')
  suggestions(@CurrentMembership() m: CompanyMember, @Param('id') id: string) {
    return this.service.listingSuggestions(m.companyId, id);
  }

  @Post(':id/accept-suggestion')
  @CompanyRoles(...writeRoles)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  accept(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() dto: AcceptMarketplaceLinkSuggestionDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.acceptSuggestion(
      m.companyId,
      u.id,
      id,
      dto.productId,
      key,
    );
  }
}

@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@ApiTags('Product marketplace links')
@Controller('products')
export class ProductMarketplaceLinksByProductController {
  constructor(private readonly service: ProductMarketplaceLinksService) {}

  @Get('unlinked-marketplaces')
  unlinked(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListUnlinkedProductsDto,
  ) {
    return this.service.unlinkedProducts(m.companyId, q);
  }

  @Get(':id/marketplace-links')
  links(@CurrentMembership() m: CompanyMember, @Param('id') id: string) {
    return this.service.productLinks(m.companyId, id);
  }
}
