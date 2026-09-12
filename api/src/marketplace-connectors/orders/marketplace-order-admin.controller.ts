import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { CompanyRoles } from '../../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../../companies/entities/company-member.entity';
import { CompanyGuard } from '../../companies/guards/company.guard';
import { CompanyRolesGuard } from '../../companies/guards/company-roles.guard';
import { MarketplaceWebhookEvent } from '../../orders/entities/marketplace-webhook-event.entity';
import { Order } from '../../orders/entities/order.entity';
import { MarketplaceOrderQueueService } from './marketplace-order-queue.service';
@ApiTags('Marketplace order processing')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller()
export class MarketplaceOrderAdminController {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(MarketplaceWebhookEvent)
    private events: Repository<MarketplaceWebhookEvent>,
    private queue: MarketplaceOrderQueueService,
  ) {}
  @Get('marketplace-webhook-events') list(
    @CurrentMembership() m: CompanyMember,
    @Query('status') status?: string,
  ) {
    return this.events
      .createQueryBuilder('e')
      .where('e.company_id=:companyId', { companyId: m.companyId })
      .andWhere(status ? 'e.status=:status' : '1=1', { status })
      .orderBy('e.received_at', 'DESC')
      .take(100)
      .getMany();
  }
  @Post('marketplace-webhook-events/:id/retry')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.SUPPORT)
  async retry(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const e = await this.events.findOneBy({ id, companyId: m.companyId });
    if (!e?.marketplaceAccountId || !e.externalOrderId)
      throw new NotFoundException('Evento não encontrado ou não processável.');
    return this.queue.enqueueOrder(
      m.companyId,
      e.marketplaceAccountId,
      e.externalOrderId,
      'MANUAL',
      { webhookEventId: e.id, requestedByUserId: u.id },
    );
  }
  @Post('marketplace-accounts/:id/sync-orders')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  sync(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queue.enqueueReconciliation(m.companyId, id, u.id);
  }
  @Post('orders/:id/reprocess')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.SUPPORT)
  async reprocess(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const o = await this.orders.findOneBy({ id, companyId: m.companyId });
    if (!o?.salesChannelConnectionId || !o.externalOrderId)
      throw new NotFoundException('Pedido externo não encontrado.');
    return this.queue.enqueueOrder(
      m.companyId,
      o.salesChannelConnectionId,
      o.externalOrderId,
      'MANUAL',
      { requestedByUserId: u.id },
    );
  }
  @Post('orders/:id/retry-stock-reservation')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  async retryStock(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reprocess(m, u, id);
  }
}
