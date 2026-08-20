import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
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
import { User } from '../users/entities/user.entity';
import {
  AdjustmentDto,
  ListInventoryDto,
  ListMovementsDto,
  ListReservationsDto,
  ReservationDto,
  StockOperationDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';
@ApiTags('Inventory')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@ApiHeader({
  name: 'Idempotency-Key',
  required: false,
  description: 'UUID obrigatório nas operações mutáveis',
})
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly s: InventoryService) {}
  @Get() list(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListInventoryDto,
  ) {
    return this.s.listBalances(m.companyId, q);
  }
  @Get('summary') summary(@CurrentMembership() m: CompanyMember) {
    return this.s.summary(m.companyId);
  }
  @Get('products/:productId') balance(
    @CurrentMembership() m: CompanyMember,
    @Param('productId') p: string,
  ) {
    return this.s.getBalance(m.companyId, p);
  }
  @Post('entries')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  entry(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() d: StockOperationDto,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.entry(m.companyId, u.id, d, k);
  }
  @Post('exits')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  exit(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() d: StockOperationDto,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.exit(m.companyId, u.id, d, k);
  }
  @Post('adjustments')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  adjust(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() d: AdjustmentDto,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.adjust(m.companyId, u.id, d, k);
  }
  @Get('movements') movements(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListMovementsDto,
  ) {
    if (m.role === CompanyRole.SUPPORT) throw new ForbiddenException();
    return this.s.listMovements(m.companyId, q);
  }
  @Get('movements/:id') movement(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.s.movement(m.companyId, id);
  }
  @Post('movements/:id/reverse')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  reverse(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.reverseSale(m.companyId, u.id, id, k);
  }
  @Post('reservations')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  reserve(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() d: ReservationDto,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.createReservation(m.companyId, u.id, d, k);
  }
  @Get('reservations') reservations(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListReservationsDto,
  ) {
    return this.s.listReservations(m.companyId, q);
  }
  @Get('reservations/:id') reservation(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.s.reservation(m.companyId, id);
  }
  @Post('reservations/:id/cancel')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  cancel(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.cancelReservation(m.companyId, u.id, id, k);
  }
  @Post('reservations/:id/complete')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  complete(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Headers('idempotency-key') k: string,
  ) {
    return this.s.completeReservation(m.companyId, u.id, id, k);
  }
}
