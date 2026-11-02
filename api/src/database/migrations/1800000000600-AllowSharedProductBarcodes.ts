import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowSharedProductBarcodes1800000000600 implements MigrationInterface {
  name = 'AllowSharedProductBarcodes1800000000600';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_product_company_barcode"');
    await queryRunner.query(
      'CREATE INDEX "IDX_product_company_barcode" ON "products" ("company_id", "barcode") WHERE "barcode" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL rejects this rollback if duplicates exist; never delete products.
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_product_company_barcode" ON "products" ("company_id", "barcode") WHERE "barcode" IS NOT NULL',
    );
    await queryRunner.query('DROP INDEX "IDX_product_company_barcode"');
  }
}
