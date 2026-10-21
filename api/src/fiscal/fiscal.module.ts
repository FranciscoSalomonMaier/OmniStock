import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { FiscalController } from './fiscal.controller';
import {
  FiscalService,
  DisabledFiscalNumberReservationService,
} from './fiscal.service';
import { FiscalReadinessService } from './fiscal-readiness.service';
import { FiscalPermissionsGuard } from './fiscal-permissions';
import { FiscalNumberReservationService } from './fiscal.contracts';
@Module({
  imports: [CompaniesModule],
  controllers: [FiscalController],
  providers: [
    FiscalService,
    FiscalReadinessService,
    FiscalPermissionsGuard,
    {
      provide: FiscalNumberReservationService,
      useClass: DisabledFiscalNumberReservationService,
    },
  ],
  exports: [FiscalReadinessService, FiscalNumberReservationService],
})
export class FiscalModule {}
