import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { CompanyRoles } from '../../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../../companies/entities/company-member.entity';
import { CompanyGuard } from '../../companies/guards/company.guard';
import { CompanyRolesGuard } from '../../companies/guards/company-roles.guard';
import { User } from '../../users/entities/user.entity';
import { MercadoLivreAuthorizeDto } from './dto/mercado-livre.dto';
import { MercadoLivreIntegrationService } from './mercado-livre-integration.service';
import { MercadoLivreSyncService } from './mercado-livre-sync.service';
import { MercadoLivreOperationsService } from './mercado-livre-operations.service';
import {
  UpdateMarketplacePriceDto,
  UpdateMarketplaceStockDto,
} from './dto/mercado-livre-operation.dto';
@ApiTags('Mercado Livre')
@Controller('integrations/mercado-livre')
export class MercadoLivreController {
  constructor(
    private readonly service: MercadoLivreIntegrationService,
    private readonly sync: MercadoLivreSyncService,
    private readonly operations: MercadoLivreOperationsService,
  ) {}
  @Post('authorize')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiOperation({ summary: 'Inicia o OAuth real do Mercado Livre' })
  authorize(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: MercadoLivreAuthorizeDto,
  ) {
    return this.service.authorize(m.companyId, dto.connectionId, u.id);
  }
  @Get('callback') async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    return res.redirect(await this.service.callback(code, state, error));
  }
  @Get('connections/:connectionId/account')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  account(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.service.account(m.companyId, id);
  }
  @Post('connections/:connectionId/sync/listings')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  syncListings(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.sync.enqueue(m.companyId, id, 'IMPORT_LISTINGS');
  }
  @Post('connections/:connectionId/sync/orders')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(
    CompanyRole.ADMIN,
    CompanyRole.MANAGER,
    CompanyRole.BILLING,
    CompanyRole.SUPPORT,
  )
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  syncOrders(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.sync.enqueue(m.companyId, id, 'IMPORT_ORDERS');
  }
  @Get('connections/:connectionId/sync-runs')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  runs(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.sync.listRuns(m.companyId, id);
  }
  @Get('connections/:connectionId/listings')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  listings(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.operations.listListings(m.companyId, id);
  }
  @Get('connections/:connectionId/orders')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(
    CompanyRole.ADMIN,
    CompanyRole.MANAGER,
    CompanyRole.BILLING,
    CompanyRole.SUPPORT,
    CompanyRole.VIEWER,
  )
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  orders(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
  ) {
    return this.operations.listOrders(m.companyId, id);
  }
  @Get('connections/:connectionId/orders/:orderId')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(
    CompanyRole.ADMIN,
    CompanyRole.MANAGER,
    CompanyRole.BILLING,
    CompanyRole.SUPPORT,
    CompanyRole.VIEWER,
  )
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  order(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
    @Param('orderId') orderId: string,
  ) {
    return this.operations.externalOrder(m.companyId, id, orderId);
  }
  @Get('connections/:connectionId/shipments/:shipmentId')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  shipment(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.operations.shipment(m.companyId, id, shipmentId);
  }
  @Post('connections/:connectionId/stock')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  stock(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
    @Body() dto: UpdateMarketplaceStockDto,
  ) {
    return this.operations.updateStock(m.companyId, id, dto);
  }
  @Post('connections/:connectionId/price')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Company-Id', required: true })
  price(
    @CurrentMembership() m: CompanyMember,
    @Param('connectionId') id: string,
    @Body() dto: UpdateMarketplacePriceDto,
  ) {
    return this.operations.updatePrice(m.companyId, id, dto);
  }
}
