import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateMercadoLivreImports1723767100000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE "marketplace_sync_runs_status_enum" AS ENUM('PENDING','RUNNING','SUCCEEDED','FAILED')`,
    );
    await q.query(
      `CREATE TYPE "marketplace_notifications_status_enum" AS ENUM('RECEIVED','QUEUED','PROCESSING','PROCESSED','IGNORED','FAILED')`,
    );
    await q.query(
      `CREATE TABLE "marketplace_listings"("id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,"company_id" uuid NOT NULL,"connection_id" uuid NOT NULL,"sales_channel_id" uuid NOT NULL,"external_item_id" varchar(80) NOT NULL,"external_variation_id" varchar(80),"external_seller_id" varchar(80) NOT NULL,"external_sku" varchar(160),"title" varchar(240) NOT NULL,"status" varchar(60) NOT NULL,"price" numeric(18,2) NOT NULL,"currency" varchar(3) NOT NULL,"available_quantity" integer,"sold_quantity" integer,"thumbnail_url" text,"last_synced_at" timestamptz NOT NULL,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,FOREIGN KEY("connection_id") REFERENCES "sales_channel_connections"("id") ON DELETE RESTRICT,FOREIGN KEY("sales_channel_id") REFERENCES "sales_channels"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_marketplace_listing_external" ON "marketplace_listings"("company_id","connection_id","external_item_id",COALESCE("external_variation_id",''))`,
    );
    await q.query(
      `CREATE TABLE "marketplace_order_imports"("id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,"company_id" uuid NOT NULL,"connection_id" uuid NOT NULL,"external_order_id" varchar(80) NOT NULL,"status" varchar(60) NOT NULL,"payment_status" varchar(60),"shipping_status" varchar(60),"buyer_nickname" varchar(160),"purchased_at" timestamptz NOT NULL,"external_updated_at" timestamptz NOT NULL,"currency" varchar(3) NOT NULL,"total_amount" numeric(18,2) NOT NULL,"shipment_id" varchar(80),"last_synced_at" timestamptz NOT NULL,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,UNIQUE("company_id","connection_id","external_order_id"),FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,FOREIGN KEY("connection_id") REFERENCES "sales_channel_connections"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE TABLE "marketplace_order_import_items"("id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,"company_id" uuid NOT NULL,"marketplace_order_import_id" uuid NOT NULL,"external_item_id" varchar(80) NOT NULL,"external_variation_id" varchar(80),"external_sku" varchar(160),"title" varchar(240) NOT NULL,"quantity" integer NOT NULL,"unit_price" numeric(18,2) NOT NULL,"total_price" numeric(18,2) NOT NULL,"currency" varchar(3) NOT NULL,FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,FOREIGN KEY("marketplace_order_import_id") REFERENCES "marketplace_order_imports"("id") ON DELETE CASCADE)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_marketplace_order_item_external" ON "marketplace_order_import_items"("company_id","marketplace_order_import_id","external_item_id",COALESCE("external_variation_id",''))`,
    );
    await q.query(
      `CREATE TABLE "marketplace_sync_runs"("id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,"company_id" uuid NOT NULL,"connection_id" uuid NOT NULL,"operation" varchar(50) NOT NULL,"status" "marketplace_sync_runs_status_enum" NOT NULL,"correlation_id" uuid NOT NULL,"started_at" timestamptz,"finished_at" timestamptz,"processed_count" integer DEFAULT 0 NOT NULL,"success_count" integer DEFAULT 0 NOT NULL,"failure_count" integer DEFAULT 0 NOT NULL,"cursor" text,"error_code" varchar(80),"error_message" varchar(500),"created_at" timestamptz DEFAULT now() NOT NULL,FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,FOREIGN KEY("connection_id") REFERENCES "sales_channel_connections"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE INDEX "IDX_marketplace_sync_run_company" ON "marketplace_sync_runs"("company_id","connection_id","created_at")`,
    );
    await q.query(
      `CREATE TABLE "marketplace_notifications"("id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,"payload_hash" varchar(64) UNIQUE NOT NULL,"application_id" varchar(80),"external_user_id" varchar(80),"topic" varchar(80) NOT NULL,"resource" varchar(500) NOT NULL,"attempts" integer,"sent_at" timestamptz,"received_at" timestamptz NOT NULL,"status" "marketplace_notifications_status_enum" NOT NULL,"company_id" uuid,"connection_id" uuid,"processed_at" timestamptz,"error_code" varchar(80),"error_message" varchar(500),"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,FOREIGN KEY("connection_id") REFERENCES "sales_channel_connections"("id") ON DELETE RESTRICT)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "marketplace_notifications"');
    await q.query('DROP TABLE "marketplace_sync_runs"');
    await q.query('DROP TABLE "marketplace_order_import_items"');
    await q.query('DROP TABLE "marketplace_order_imports"');
    await q.query('DROP TABLE "marketplace_listings"');
    await q.query('DROP TYPE "marketplace_notifications_status_enum"');
    await q.query('DROP TYPE "marketplace_sync_runs_status_enum"');
  }
}
