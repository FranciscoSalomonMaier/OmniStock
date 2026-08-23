import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
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
  CreateSalesChannelConnectionDto,
  UpdateSalesChannelConnectionDto,
} from './dto/sales-channel.dto';
import { SalesChannelConnectionStatus } from './enums/sales-channel.enums';
import { SalesChannelsService } from './sales-channels.service';
import { MarketplaceIntegrationService } from '../marketplace-connectors/marketplace-integration.service';

@ApiTags('Sales channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales-channels')
export class SalesChannelsCatalogController {
  constructor(private readonly service: SalesChannelsService) {}
  @Get() list() {
    return this.service.catalog();
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.channel(id);
  }
}

@ApiTags('Sales channel connections')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('sales-channel-connections')
export class SalesChannelConnectionsController {
  constructor(
    private readonly service: SalesChannelsService,
    private readonly integrations: MarketplaceIntegrationService,
  ) {}
  @Get() list(@CurrentMembership() m: CompanyMember) {
    return this.service.list(m.companyId);
  }
  @Get(':id') get(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.service.response(m.companyId, id);
  }
  @Post()
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  create(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: CreateSalesChannelConnectionDto,
  ) {
    return this.service.create(m.companyId, u.id, dto);
  }
  @Patch(':id')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  update(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() dto: UpdateSalesChannelConnectionDto,
  ) {
    return this.service.rename(m.companyId, id, u.id, dto);
  }
  @Post(':id/validate')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiOperation({
    summary: 'Valida uma conexão por meio do conector configurado',
  })
  @ApiBadRequestResponse({
    description:
      'CONNECTOR_DISABLED, CONNECTOR_NOT_IMPLEMENTED, OPERATION_NOT_SUPPORTED ou REAUTH_REQUIRED',
  })
  validate(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.integrations.validateConnection(m.companyId, id, u.id);
  }
  @Get(':id/capabilities')
  @ApiOperation({
    summary: 'Lista suporte do provedor e operações implementadas no OmniStock',
  })
  capabilities(@CurrentMembership() m: CompanyMember, @Param('id') id: string) {
    return this.integrations.capabilities(m.companyId, id);
  }
  @Post(':id/disable')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  disable(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.service.status(
      m.companyId,
      id,
      u.id,
      SalesChannelConnectionStatus.DISABLED,
    );
  }
  @Post(':id/enable')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  enable(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.service.status(
      m.companyId,
      id,
      u.id,
      SalesChannelConnectionStatus.PENDING,
    );
  }
  @Delete(':id')
  @CompanyRoles(CompanyRole.ADMIN)
  disconnect(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.service.disconnect(m.companyId, id, u.id);
  }
}
