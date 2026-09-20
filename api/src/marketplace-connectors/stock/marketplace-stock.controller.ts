import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { CompanyRoles } from '../../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../../companies/entities/company-member.entity';
import { CompanyGuard } from '../../companies/guards/company.guard';
import { CompanyRolesGuard } from '../../companies/guards/company-roles.guard';
import { MarketplaceStockSyncService } from './marketplace-stock-sync.service';
import { StockSyncStatus } from './marketplace-stock-sync.entity';
class ResolveDivergenceDto {
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
@ApiTags('Marketplace stock synchronization')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller()
export class MarketplaceStockController {
  constructor(private service: MarketplaceStockSyncService) {}
  @Get('marketplace-stock-syncs') list(
    @CurrentMembership() m: CompanyMember,
    @Query('status') status?: StockSyncStatus,
  ) {
    return this.service.list(m.companyId, status);
  }
  @Get('marketplace-stock-divergences') divergences(
    @CurrentMembership() m: CompanyMember,
  ) {
    return this.service.listDivergences(m.companyId);
  }
  @Post('inventory/products/:productId/sync-stock')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  sync(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('productId', ParseUUIDPipe) id: string,
  ) {
    return this.service.requestProduct(m.companyId, id, u.id);
  }
  @Post('marketplace-stock-syncs/:id/retry')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  retry(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.retry(m.companyId, id, u.id);
  }
  @Post('marketplace-stock-divergences/:id/resolve')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  resolve(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ResolveDivergenceDto,
  ) {
    return this.service.resolveDivergence(m.companyId, id, u.id, d.notes);
  }
  @Post('marketplace-accounts/:accountId/reconcile-stock')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  reconcile(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('accountId', ParseUUIDPipe) id: string,
  ) {
    return this.service.reconcileAccount(m.companyId, id, u.id);
  }
}
