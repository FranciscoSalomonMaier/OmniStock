import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateInventory1723766800000 implements MigrationInterface {
  name = 'CreateInventory1723766800000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE "inventory_movement_type_enum" AS ENUM('ENTRY','EXIT','ADJUSTMENT_INCREASE','ADJUSTMENT_DECREASE','RESERVATION','RESERVATION_CANCELED','SALE_COMPLETED','SALE_CANCELED_REVERSAL')`,
    );
    await q.query(
      `CREATE TYPE "inventory_reservation_status_enum" AS ENUM('ACTIVE','COMPLETED','CANCELED','EXPIRED')`,
    );
    await q.query(
      `CREATE TYPE "inventory_reference_type_enum" AS ENUM('MANUAL','SALE','ORDER','INVENTORY_COUNT','IMPORT','SYSTEM')`,
    );
    await q.query(
      `CREATE TABLE "inventory_balances"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"product_id" uuid NOT NULL,"current_quantity" numeric(18,3) NOT NULL DEFAULT 0,"reserved_quantity" numeric(18,3) NOT NULL DEFAULT 0,"version" integer NOT NULL DEFAULT 1,"created_at" TIMESTAMP NOT NULL DEFAULT now(),"updated_at" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "PK_inventory_balances" PRIMARY KEY("id"),CONSTRAINT "UQ_inventory_balance_company_product" UNIQUE("company_id","product_id"),CONSTRAINT "CK_inventory_current_nonnegative" CHECK("current_quantity">=0),CONSTRAINT "CK_inventory_reserved_valid" CHECK("reserved_quantity">=0 AND "reserved_quantity"<="current_quantity"),CONSTRAINT "FK_inventory_balance_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,CONSTRAINT "FK_inventory_balance_product" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE TABLE "inventory_movements"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"product_id" uuid NOT NULL,"inventory_balance_id" uuid NOT NULL,"type" "inventory_movement_type_enum" NOT NULL,"quantity" numeric(18,3) NOT NULL,"current_quantity_before" numeric(18,3) NOT NULL,"current_quantity_after" numeric(18,3) NOT NULL,"reserved_quantity_before" numeric(18,3) NOT NULL,"reserved_quantity_after" numeric(18,3) NOT NULL,"available_quantity_before" numeric(18,3) NOT NULL,"available_quantity_after" numeric(18,3) NOT NULL,"reason" varchar(240) NOT NULL,"notes" text,"reference_type" "inventory_reference_type_enum","reference_id" varchar(160),"idempotency_key" uuid,"request_hash" varchar(64),"performed_by_user_id" uuid,"reversal_of_movement_id" uuid,"occurred_at" timestamptz NOT NULL DEFAULT now(),"created_at" timestamptz NOT NULL DEFAULT now(),CONSTRAINT "PK_inventory_movements" PRIMARY KEY("id"),CONSTRAINT "CK_inventory_movement_quantity" CHECK("quantity">0),CONSTRAINT "FK_movement_balance" FOREIGN KEY("inventory_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT,CONSTRAINT "FK_movement_product" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,CONSTRAINT "FK_movement_user" FOREIGN KEY("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,CONSTRAINT "FK_movement_reversal" FOREIGN KEY("reversal_of_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_inventory_idempotency" ON "inventory_movements"("company_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_inventory_single_reversal" ON "inventory_movements"("reversal_of_movement_id") WHERE "reversal_of_movement_id" IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX "IDX_inventory_movements_company_date" ON "inventory_movements"("company_id","occurred_at")`,
    );
    await q.query(
      `CREATE TABLE "inventory_reservations"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"product_id" uuid NOT NULL,"inventory_balance_id" uuid NOT NULL,"quantity" numeric(18,3) NOT NULL,"status" "inventory_reservation_status_enum" NOT NULL DEFAULT 'ACTIVE',"reference_type" "inventory_reference_type_enum" NOT NULL,"reference_id" varchar(160) NOT NULL,"reason" varchar(240),"expires_at" timestamptz,"created_by_user_id" uuid,"completed_at" timestamptz,"canceled_at" timestamptz,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now(),CONSTRAINT "PK_inventory_reservations" PRIMARY KEY("id"),CONSTRAINT "CK_inventory_reservation_quantity" CHECK("quantity">0),CONSTRAINT "UQ_inventory_reservation_reference" UNIQUE("company_id","product_id","reference_type","reference_id"),CONSTRAINT "FK_reservation_balance" FOREIGN KEY("inventory_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT,CONSTRAINT "FK_reservation_product" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,CONSTRAINT "FK_reservation_user" FOREIGN KEY("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE INDEX "IDX_inventory_reservations_company_status" ON "inventory_reservations"("company_id","status")`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "inventory_reservations"');
    await q.query('DROP TABLE "inventory_movements"');
    await q.query('DROP TABLE "inventory_balances"');
    await q.query('DROP TYPE "inventory_reference_type_enum"');
    await q.query('DROP TYPE "inventory_reservation_status_enum"');
    await q.query('DROP TYPE "inventory_movement_type_enum"');
  }
}
