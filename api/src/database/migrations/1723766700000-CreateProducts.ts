import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateProducts1723766700000 implements MigrationInterface {
  name = 'CreateProducts1723766700000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE "product_unit_enum" AS ENUM('UN','KG','G','L','ML','M','CM','M2','M3','CX','PCT','PAR')`,
    );
    await q.query(
      `CREATE TYPE "product_status_enum" AS ENUM('ACTIVE','INACTIVE','DISCONTINUED')`,
    );
    await q.query(
      `CREATE TYPE "product_origin_enum" AS ENUM('0','1','2','3','4','5','6','7','8')`,
    );
    await q.query(
      `CREATE TABLE "product_categories"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"name" varchar(120) NOT NULL,"normalized_name" varchar(120) NOT NULL,"description" text,"is_active" boolean NOT NULL DEFAULT true,"created_at" TIMESTAMP NOT NULL DEFAULT now(),"updated_at" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "PK_product_categories" PRIMARY KEY("id"),CONSTRAINT "FK_category_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,CONSTRAINT "UQ_category_company_name" UNIQUE("company_id","normalized_name"))`,
    );
    await q.query(
      `CREATE TABLE "products"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"category_id" uuid,"sku" varchar(64) NOT NULL,"name" varchar(180) NOT NULL,"description" text,"barcode" varchar(32),"unit_of_measure" "product_unit_enum" NOT NULL,"cost_price" decimal(15,2),"sale_price" decimal(15,2) NOT NULL,"ncm" varchar(8),"cest" varchar(7),"default_cfop" varchar(4),"merchandise_origin" "product_origin_enum","weight" decimal(12,3),"height" decimal(12,2),"width" decimal(12,2),"length" decimal(12,2),"minimum_stock" decimal(15,3) NOT NULL DEFAULT 0,"status" "product_status_enum" NOT NULL DEFAULT 'ACTIVE',"created_at" TIMESTAMP NOT NULL DEFAULT now(),"updated_at" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "PK_products" PRIMARY KEY("id"),CONSTRAINT "FK_product_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,CONSTRAINT "FK_product_category" FOREIGN KEY("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT,CONSTRAINT "UQ_product_company_sku" UNIQUE("company_id","sku"))`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_product_company_barcode" ON "products"("company_id","barcode") WHERE "barcode" IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX "IDX_products_company_status" ON "products"("company_id","status")`,
    );
    await q.query(
      `CREATE INDEX "IDX_products_company_name" ON "products"("company_id","name")`,
    );
    await q.query(
      `CREATE TABLE "product_images"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"company_id" uuid NOT NULL,"product_id" uuid NOT NULL,"storage_key" varchar NOT NULL,"original_name" varchar NOT NULL,"mime_type" varchar(50) NOT NULL,"size" integer NOT NULL,"sort_order" integer NOT NULL DEFAULT 0,"is_primary" boolean NOT NULL DEFAULT false,"created_at" TIMESTAMP NOT NULL DEFAULT now(),"updated_at" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "PK_product_images" PRIMARY KEY("id"),CONSTRAINT "FK_image_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,CONSTRAINT "FK_image_product" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE CASCADE)`,
    );
    await q.query(
      `CREATE INDEX "IDX_product_images_company_product" ON "product_images"("company_id","product_id")`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "product_images"');
    await q.query('DROP TABLE "products"');
    await q.query('DROP TABLE "product_categories"');
    await q.query('DROP TYPE "product_origin_enum"');
    await q.query('DROP TYPE "product_status_enum"');
    await q.query('DROP TYPE "product_unit_enum"');
  }
}
