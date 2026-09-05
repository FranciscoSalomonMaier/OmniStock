import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductMarketplaceLinks1723767200000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE "product_marketplace_links_status_enum" AS ENUM('ACTIVE','INACTIVE','INVALID','PENDING_VALIDATION')`,
    );
    await q.query(
      `CREATE TYPE "product_marketplace_links_link_source_enum" AS ENUM('MANUAL','SKU_EXACT_MATCH','BARCODE_EXACT_MATCH','IMPORTED','API','MIGRATION')`,
    );
    await q.query(
      `CREATE TYPE "product_marketplace_links_matched_by_field_enum" AS ENUM('SKU','BARCODE','EXTERNAL_ID','MANUAL_SELECTION','NONE')`,
    );
    await q.query(
      `CREATE TYPE "product_marketplace_links_last_validation_status_enum" AS ENUM('VALID','WARNING','INVALID','NOT_VALIDATED')`,
    );
    await q.query(
      `CREATE TYPE "product_marketplace_link_audits_event_enum" AS ENUM('LINK_CREATED','SUGGESTION_ACCEPTED','BULK_LINK_CREATED','LINK_VALIDATED','LINK_UNLINKED','LINK_CONFLICT')`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_products_company_id_id" ON "products"("company_id","id")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_marketplace_listings_company_id_id" ON "marketplace_listings"("company_id","id")`,
    );
    await q.query(`CREATE TABLE "product_marketplace_links"(
      "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "company_id" uuid NOT NULL,
      "product_id" uuid NOT NULL,
      "marketplace_listing_id" uuid NOT NULL,
      "status" "product_marketplace_links_status_enum" NOT NULL,
      "link_source" "product_marketplace_links_link_source_enum" NOT NULL,
      "match_confidence" numeric(5,4),
      "matched_by_field" "product_marketplace_links_matched_by_field_enum",
      "linked_by_user_id" uuid NOT NULL,
      "unlinked_by_user_id" uuid,
      "linked_at" timestamptz NOT NULL,
      "unlinked_at" timestamptz,
      "unlink_reason" varchar(500),
      "last_validated_at" timestamptz,
      "last_validation_status" "product_marketplace_links_last_validation_status_enum",
      "last_validation_message" varchar(500),
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT "FK_pml_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_pml_product_company" FOREIGN KEY("company_id","product_id") REFERENCES "products"("company_id","id") ON DELETE RESTRICT,
      CONSTRAINT "FK_pml_listing_company" FOREIGN KEY("company_id","marketplace_listing_id") REFERENCES "marketplace_listings"("company_id","id") ON DELETE RESTRICT,
      CONSTRAINT "FK_pml_linked_member" FOREIGN KEY("company_id","linked_by_user_id") REFERENCES "company_members"("company_id","user_id") ON DELETE RESTRICT,
      CONSTRAINT "FK_pml_unlinked_member" FOREIGN KEY("company_id","unlinked_by_user_id") REFERENCES "company_members"("company_id","user_id") ON DELETE RESTRICT
    )`);
    await q.query(
      `CREATE INDEX "IDX_pml_company" ON "product_marketplace_links"("company_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_pml_product" ON "product_marketplace_links"("product_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_pml_listing" ON "product_marketplace_links"("marketplace_listing_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_pml_status" ON "product_marketplace_links"("company_id","status")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_pml_active_listing" ON "product_marketplace_links"("company_id","marketplace_listing_id") WHERE "status" = 'ACTIVE'`,
    );
    await q.query(`CREATE TABLE "product_marketplace_link_audits"(
      "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
      "link_id" uuid REFERENCES "product_marketplace_links"("id") ON DELETE RESTRICT,
      "product_id" uuid,
      "marketplace_listing_id" uuid,
      "connection_id" uuid,
      "channel_code" varchar(40),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "event" "product_marketplace_link_audits_event_enum" NOT NULL,
      "idempotency_key" varchar(180),
      "request_hash" varchar(64),
      "details" jsonb,
      "response" jsonb,
      "created_at" timestamptz DEFAULT now() NOT NULL
    )`);
    await q.query(
      `CREATE INDEX "IDX_pml_audit_company_date" ON "product_marketplace_link_audits"("company_id","created_at")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_pml_audit_idempotency" ON "product_marketplace_link_audits"("company_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
  }

  async down(q: QueryRunner) {
    await q.query(`DROP TABLE "product_marketplace_link_audits"`);
    await q.query(`DROP TABLE "product_marketplace_links"`);
    await q.query(`DROP INDEX "UQ_marketplace_listings_company_id_id"`);
    await q.query(`DROP INDEX "UQ_products_company_id_id"`);
    await q.query(`DROP TYPE "product_marketplace_link_audits_event_enum"`);
    await q.query(
      `DROP TYPE "product_marketplace_links_last_validation_status_enum"`,
    );
    await q.query(
      `DROP TYPE "product_marketplace_links_matched_by_field_enum"`,
    );
    await q.query(`DROP TYPE "product_marketplace_links_link_source_enum"`);
    await q.query(`DROP TYPE "product_marketplace_links_status_enum"`);
  }
}
