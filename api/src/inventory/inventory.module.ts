import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryReservation } from './entities/inventory-reservation.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryBalance,
      InventoryMovement,
      InventoryReservation,
    ]),
    CompaniesModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
