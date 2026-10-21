import { FiscalExceptionFilter } from './fiscal-exception.filter';
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseFilters,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import {
  FiscalPermissionsGuard,
  RequireFiscalPermission,
} from './fiscal-permissions';
import { FiscalService } from './fiscal.service';
import { FiscalReadinessService } from './fiscal-readiness.service';
import { ProductTaxRule } from './entities/fiscal.entity';
import {
  EstablishmentDto,
  UpdateEstablishmentDto,
  DocumentSettingDto,
  UpdateDocumentSettingDto,
  ChangeNumberDto,
  ActivationDto,
  ProductFiscalProfileDto,
  TaxRuleDto,
  UpdateTaxRuleDto,
  ReviewDto,
  ReasonDto,
  FiscalListDto,
} from './fiscal.dto';
@ApiTags('Fiscal')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, FiscalPermissionsGuard)
@UseFilters(FiscalExceptionFilter)
@Controller()
export class FiscalController {
  constructor(
    private fiscal: FiscalService,
    private readiness: FiscalReadinessService,
    private permissions: FiscalPermissionsGuard,
  ) {}
  @Get('fiscal/permissions')
  @RequireFiscalPermission('fiscal.products.read')
  @ApiOperation({ summary: 'effectivePermissions' })
  async effectivePermissions(@CurrentMembership() m: CompanyMember) {
    return this.permissions.permissions(m);
  }
  @Get('fiscal')
  @RequireFiscalPermission('fiscal.establishments.read')
  @ApiOperation({ summary: 'overview' })
  async overview(@CurrentMembership() m: CompanyMember) {
    return this.readiness.overview(m.companyId);
  }
  @Get('fiscal/establishments')
  @RequireFiscalPermission('fiscal.establishments.read')
  @ApiOperation({ summary: 'listEstablishments' })
  async listEstablishments(
    @CurrentMembership() m: CompanyMember,
    @Query() q: FiscalListDto,
  ) {
    return this.fiscal.list('establishments', m.companyId, q);
  }
  @Get('fiscal/document-settings')
  @RequireFiscalPermission('fiscal.document_settings.read')
  @ApiOperation({ summary: 'listDocumentsettings' })
  async listDocumentsettings(
    @CurrentMembership() m: CompanyMember,
    @Query() q: FiscalListDto,
  ) {
    return this.fiscal.list('document-settings', m.companyId, q);
  }
  @Get('fiscal/tax-rules')
  @RequireFiscalPermission('fiscal.tax_rules.read')
  @ApiOperation({ summary: 'listTaxrules' })
  async listTaxrules(
    @CurrentMembership() m: CompanyMember,
    @Query() q: FiscalListDto,
  ) {
    return this.fiscal.list('tax-rules', m.companyId, q);
  }
  @Get('fiscal/establishments/:id')
  @RequireFiscalPermission('fiscal.establishments.read')
  @ApiOperation({ summary: 'getEstablishment' })
  async getEstablishment(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiscal.getEstablishment(m.companyId, id);
  }
  @Post('fiscal/establishments')
  @RequireFiscalPermission('fiscal.establishments.manage')
  @ApiOperation({ summary: 'createEstablishment' })
  async createEstablishment(
    @CurrentMembership() m: CompanyMember,
    @Body() d: EstablishmentDto,
  ) {
    return this.fiscal.saveEstablishment(m.companyId, m.userId, d);
  }
  @Patch('fiscal/establishments/:id')
  @RequireFiscalPermission('fiscal.establishments.manage')
  @ApiOperation({ summary: 'updateEstablishment' })
  async updateEstablishment(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateEstablishmentDto,
  ) {
    return this.fiscal.saveEstablishment(m.companyId, m.userId, d, id);
  }
  @Post('fiscal/establishments/:id/set-default')
  @RequireFiscalPermission('fiscal.establishments.manage')
  @ApiOperation({ summary: 'setDefault' })
  async setDefault(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiscal.setDefault(m.companyId, m.userId, id);
  }
  @Post('fiscal/establishments/:id/submit-review')
  @RequireFiscalPermission('fiscal.review.submit')
  @ApiOperation({ summary: 'establishmentssubmit' })
  async establishmentssubmit(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiscal.review(m.companyId, m.userId, 'ESTABLISHMENT', id);
  }
  @Post('fiscal/establishments/:id/approve')
  @RequireFiscalPermission('fiscal.review.approve')
  @ApiOperation({ summary: 'establishmentsapprove' })
  async establishmentsapprove(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReviewDto,
  ) {
    return this.fiscal.review(m.companyId, m.userId, 'ESTABLISHMENT', id, d);
  }
  @Post('fiscal/tax-rules/:id/submit-review')
  @RequireFiscalPermission('fiscal.review.submit')
  @ApiOperation({ summary: 'taxrulessubmit' })
  async taxrulessubmit(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiscal.review(m.companyId, m.userId, 'TAX_RULE', id);
  }
  @Post('fiscal/tax-rules/:id/approve')
  @RequireFiscalPermission('fiscal.review.approve')
  @ApiOperation({ summary: 'taxrulesapprove' })
  async taxrulesapprove(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReviewDto,
  ) {
    return this.fiscal.review(m.companyId, m.userId, 'TAX_RULE', id, d);
  }
  @Post('fiscal/document-settings')
  @RequireFiscalPermission('fiscal.document_settings.manage')
  @ApiOperation({ summary: 'createSetting' })
  async createSetting(
    @CurrentMembership() m: CompanyMember,
    @Body() d: DocumentSettingDto,
  ) {
    return this.fiscal.saveSetting(m.companyId, m.userId, d);
  }
  @Patch('fiscal/document-settings/:id')
  @RequireFiscalPermission('fiscal.document_settings.manage')
  @ApiOperation({ summary: 'updateSetting' })
  async updateSetting(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateDocumentSettingDto,
  ) {
    return this.fiscal.saveSetting(m.companyId, m.userId, d, id);
  }
  @Post('fiscal/document-settings/:id/activate')
  @RequireFiscalPermission('fiscal.document_settings.manage')
  @ApiOperation({ summary: 'activateSetting' })
  async activateSetting(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActivationDto,
  ) {
    return this.fiscal.settingActive(
      m.companyId,
      m.userId,
      id,
      true,
      d.confirmProduction,
      d.reason,
    );
  }
  @Post('fiscal/document-settings/:id/deactivate')
  @RequireFiscalPermission('fiscal.document_settings.manage')
  @ApiOperation({ summary: 'deactivateSetting' })
  async deactivateSetting(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActivationDto,
  ) {
    return this.fiscal.settingActive(
      m.companyId,
      m.userId,
      id,
      false,
      d.confirmProduction,
      d.reason,
    );
  }
  @Post('fiscal/document-settings/:id/change-next-number')
  @RequireFiscalPermission('fiscal.document_settings.change_number')
  @ApiOperation({ summary: 'changeNumber' })
  async changeNumber(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ChangeNumberDto,
  ) {
    return this.fiscal.changeNumber(m.companyId, m.userId, id, d);
  }
  @Get('products/:productId/fiscal-profile')
  @RequireFiscalPermission('fiscal.products.read')
  @ApiOperation({ summary: 'profiles' })
  async profiles(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.fiscal.profiles(m.companyId, productId);
  }
  @Put('products/:productId/fiscal-profile')
  @RequireFiscalPermission('fiscal.products.manage')
  @ApiOperation({ summary: 'saveProfile' })
  async saveProfile(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() d: ProductFiscalProfileDto,
  ) {
    return this.fiscal.saveProfile(m.companyId, m.userId, productId, d);
  }
  @Post('products/:productId/fiscal-profile/submit-review')
  @RequireFiscalPermission('fiscal.review.submit')
  @ApiOperation({ summary: 'profilesubmit' })
  async profilesubmit(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const p = await this.fiscal.currentProfile(m.companyId, productId);
    return this.fiscal.review(m.companyId, m.userId, 'PRODUCT_PROFILE', p.id);
  }
  @Post('products/:productId/fiscal-profile/approve')
  @RequireFiscalPermission('fiscal.review.approve')
  @ApiOperation({ summary: 'profileapprove' })
  async profileapprove(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() d: ReviewDto,
  ) {
    const p = await this.fiscal.currentProfile(m.companyId, productId);
    return this.fiscal.review(
      m.companyId,
      m.userId,
      'PRODUCT_PROFILE',
      p.id,
      d,
    );
  }
  @Get('fiscal/tax-rules/:id')
  @RequireFiscalPermission('fiscal.tax_rules.read')
  @ApiOperation({ summary: 'getRule' })
  async getRule(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiscal.find(
      this.fiscal.db.manager,
      ProductTaxRule,
      m.companyId,
      id,
    );
  }
  @Post('fiscal/tax-rules')
  @RequireFiscalPermission('fiscal.tax_rules.manage')
  @ApiOperation({ summary: 'createRule' })
  async createRule(
    @CurrentMembership() m: CompanyMember,
    @Body() d: TaxRuleDto,
  ) {
    return this.fiscal.saveRule(m.companyId, m.userId, d);
  }
  @Patch('fiscal/tax-rules/:id')
  @RequireFiscalPermission('fiscal.tax_rules.manage')
  @ApiOperation({ summary: 'updateRule' })
  async updateRule(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateTaxRuleDto,
  ) {
    return this.fiscal.saveRule(m.companyId, m.userId, d, id);
  }
  @Post('fiscal/tax-rules/:id/activate')
  @RequireFiscalPermission('fiscal.tax_rules.manage')
  @ApiOperation({ summary: 'activateRule' })
  async activateRule(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.fiscal.ruleActive(m.companyId, m.userId, id, true, d.reason);
  }
  @Post('fiscal/tax-rules/:id/deactivate')
  @RequireFiscalPermission('fiscal.tax_rules.manage')
  @ApiOperation({ summary: 'deactivateRule' })
  async deactivateRule(
    @CurrentMembership() m: CompanyMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.fiscal.ruleActive(m.companyId, m.userId, id, false, d.reason);
  }
  @Get('fiscal/readiness/company/:establishmentId')
  @RequireFiscalPermission('fiscal.establishments.read')
  @ApiOperation({ summary: 'readinessCompany' })
  async readinessCompany(
    @CurrentMembership() m: CompanyMember,
    @Param('establishmentId', ParseUUIDPipe) id: string,
  ) {
    return this.readiness.validateCompany(m.companyId, id);
  }
  @Get('fiscal/readiness/product/:productId')
  @RequireFiscalPermission('fiscal.products.read')
  @ApiOperation({ summary: 'readinessProduct' })
  async readinessProduct(
    @CurrentMembership() m: CompanyMember,
    @Param('productId', ParseUUIDPipe) id: string,
  ) {
    return this.readiness.validateProduct(m.companyId, id);
  }
  @Get('fiscal/readiness/order/:orderId')
  @RequireFiscalPermission('fiscal.establishments.read')
  @ApiOperation({ summary: 'readinessOrder' })
  async readinessOrder(
    @CurrentMembership() m: CompanyMember,
    @Param('orderId', ParseUUIDPipe) id: string,
  ) {
    return this.readiness.validateOrder(m.companyId, id);
  }
  @Get('fiscal/audit')
  @RequireFiscalPermission('fiscal.audit.read')
  @ApiOperation({ summary: 'audit' })
  async audit(
    @CurrentMembership() m: CompanyMember,
    @Query() q: FiscalListDto,
  ) {
    const data = await this.fiscal.db.query<Array<Record<string, unknown>>>(
      'SELECT * FROM fiscal_audit_logs WHERE company_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [m.companyId, q.limit || 20, ((q.page || 1) - 1) * (q.limit || 20)],
    );
    return { data };
  }
}
