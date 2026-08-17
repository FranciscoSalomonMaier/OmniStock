import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyMember } from './entities/company-member.entity';
import { Company } from './entities/company.entity';
import { CompanyGuard } from './guards/company.guard';
import { CompanyRolesGuard } from './guards/company-roles.guard';
@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyMember]), UsersModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyGuard, CompanyRolesGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
