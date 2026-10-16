import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsIn,
} from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyGuard } from '../../companies/guards/company.guard';
import { CompanyRolesGuard } from '../../companies/guards/company-roles.guard';
import { CompanyRoles } from '../../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../../companies/entities/company-member.entity';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import {
  MarketplaceWebhookEvent,
  MarketplaceWebhookEventStatus,
} from '../../orders/entities/marketplace-webhook-event.entity';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
export class WebhookQueryDto {
  @ApiPropertyOptional({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(SalesChannelCode)
  marketplace?: SalesChannelCode;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MarketplaceWebhookEventStatus)
  status?: MarketplaceWebhookEventStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['true', 'false'])
  withError?: string;
}
@ApiTags('Marketplace webhooks')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('marketplace-webhooks')
export class MarketplaceWebhookAdminController {
  constructor(
    private db: DataSource,
    private service: MarketplaceWebhookService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Lista paginada de notificações da empresa ativa' })
  async list(
    @CurrentMembership() m: CompanyMember,
    @Query() q: WebhookQueryDto,
  ) {
    const qb = this.db
      .getRepository(MarketplaceWebhookEvent)
      .createQueryBuilder('e')
      .where('e.company_id=:companyId', { companyId: m.companyId });
    for (const [field, value] of Object.entries({
      marketplace: q.marketplace,
      marketplace_account_id: q.accountId,
      status: q.status,
      event_type: q.eventType,
    }))
      if (value) qb.andWhere(`e.${field}=:${field}`, { [field]: value });
    if (q.externalId)
      qb.andWhere(
        '(e.external_event_id=:external OR e.external_resource_id=:external OR e.external_order_id=:external)',
        { external: q.externalId },
      );
    if (q.dateFrom) qb.andWhere('e.received_at>=:from', { from: q.dateFrom });
    if (q.dateTo) qb.andWhere('e.received_at<=:to', { to: q.dateTo });
    if (q.withError === 'true') qb.andWhere('e.last_error_code IS NOT NULL');
    const [data, total] = await qb
      .orderBy('e.received_at', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return {
      data: data.map((e) => this.view(e)),
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
  private view(e: MarketplaceWebhookEvent) {
    return {
      id: e.id,
      marketplace: e.marketplace,
      marketplaceAccountId: e.marketplaceAccountId,
      eventType: e.eventType,
      resource: e.resource,
      externalEventId: e.externalEventId,
      status: e.status,
      attempts: e.attempts,
      receivedAt: e.receivedAt,
      queuedAt: e.queuedAt,
      processedAt: e.processedAt,
      failedAt: e.failedAt,
      nextRetryAt: e.nextRetryAt,
      correlationId: e.correlationId,
      duplicateCount: e.duplicateCount,
      lastErrorCode: e.lastErrorCode,
      lastError: e.lastError,
      durationMs:
        e.processingStartedAt && e.processedAt
          ? e.processedAt.getTime() - e.processingStartedAt.getTime()
          : null,
      processingResult: e.processingResult,
      adminActions: e.adminActions,
    };
  }
  @Get('stats')
  @ApiOperation({
    summary: 'Contadores operacionais de webhooks da empresa ativa',
  })
  async stats(@CurrentMembership() m: CompanyMember) {
    return this.db.query<
      Array<{
        status: string;
        events: string;
        duplicates: string;
        mean_queue_ms: string | null;
        mean_processing_ms: string | null;
      }>
    >(
      `SELECT status,count(*)::text AS events,sum(duplicate_count)::text AS duplicates,avg(extract(epoch FROM (queued_at-received_at))*1000)::text AS mean_queue_ms,avg(extract(epoch FROM (processed_at-processing_started_at))*1000)::text AS mean_processing_ms FROM marketplace_webhook_events WHERE company_id=$1 GROUP BY status`,
      [m.companyId],
    );
  }
  @Get(':id') async get(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const e = await this.db
      .getRepository(MarketplaceWebhookEvent)
      .findOneBy({ id, companyId: m.companyId });
    if (!e) throw new NotFoundException('Evento não encontrado.');
    return this.view(e);
  }
  @Post(':id/retry')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.SUPPORT)
  retry(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.action(m.companyId, id, u.id, 'retry');
  }
  @Post(':id/ignore')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.SUPPORT)
  ignore(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.action(m.companyId, id, u.id, 'ignore');
  }
}
