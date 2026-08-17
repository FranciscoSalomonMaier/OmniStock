import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { User } from '../users/entities/user.entity';
import { CompaniesService } from './companies.service';
import { CompanyRoles } from './decorators/company-roles.decorator';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CompanyMember } from './entities/company-member.entity';
import { CompanyGuard } from './guards/company.guard';
import { CompanyRolesGuard } from './guards/company-roles.guard';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}
  @Post() @UseGuards(JwtAuthGuard) create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user.id);
  }
  @Get() @UseGuards(JwtAuthGuard) list(@CurrentUser() user: User) {
    return this.service.list(user.id);
  }
  @Get(':companyId')
  @UseGuards(JwtAuthGuard, CompanyGuard)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  get(@Param('companyId') id: string) {
    return this.service.get(id);
  }
  @Patch(':companyId')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  update(
    @Param('companyId') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user.id);
  }
  @Delete(':companyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  async deactivate(@Param('companyId') id: string, @CurrentUser() user: User) {
    await this.service.deactivate(id, user.id);
  }
  @Get(':companyId/members')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  members(@Param('companyId') id: string) {
    return this.service.listMembers(id);
  }
  @Post(':companyId/members')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  add(
    @Param('companyId') id: string,
    @Body() dto: AddMemberDto,
    @CurrentMembership() actor: CompanyMember,
  ) {
    return this.service.addMember(id, dto, actor);
  }
  @Patch(':companyId/members/:memberId')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  patchMember(
    @Param('companyId') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentMembership() actor: CompanyMember,
  ) {
    return this.service.updateMember(id, memberId, dto, actor);
  }
  @Delete(':companyId/members/:memberId')
  @UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  @ApiHeader({ name: 'X-Company-Id', required: true })
  remove(
    @Param('companyId') id: string,
    @Param('memberId') memberId: string,
    @CurrentMembership() actor: CompanyMember,
  ) {
    return this.service.deactivateMember(id, memberId, actor);
  }
}
