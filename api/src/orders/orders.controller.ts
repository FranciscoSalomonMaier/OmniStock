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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import {
  CancelOrderDto,
  ListOrdersDto,
  ResolveOrderIssueDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';
@ApiTags('Orders')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private s: OrdersService) {}
  @Get() list(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListOrdersDto,
  ) {
    return this.s.list(m.companyId, q);
  }
  @Get('summary') summary(@CurrentMembership() m: CompanyMember) {
    return this.s.summary(m.companyId);
  }
  @Get(':id') details(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.details(m.companyId, id, m.role);
  }
  @Get(':id/history') history(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.historyFor(m.companyId, id);
  }
  @Get(':id/issues') issues(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.issuesFor(m.companyId, id);
  }
  @Get(':id/shipment') shipment(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.shipmentFor(m.companyId, id);
  }
  @Get(':id/payments') payments(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.paymentsFor(m.companyId, id);
  }
  @Get(':id/fiscal') fiscal(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.fiscalFor(m.companyId, id);
  }
  @Post(':id/cancel')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.BILLING)
  cancel(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CancelOrderDto,
  ) {
    return this.s.cancel(m.companyId, id, u.id, d);
  }
  @Post(':id/reprocess')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.SUPPORT)
  reprocess(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.reprocess(m.companyId, id);
  }
  @Post(':id/issues/:issueId/resolve')
  @CompanyRoles(
    CompanyRole.ADMIN,
    CompanyRole.MANAGER,
    CompanyRole.STOCKIST,
    CompanyRole.BILLING,
    CompanyRole.SUPPORT,
  )
  resolve(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() d: ResolveOrderIssueDto,
  ) {
    return this.s.resolve(m.companyId, id, issueId, u.id, d);
  }
}
