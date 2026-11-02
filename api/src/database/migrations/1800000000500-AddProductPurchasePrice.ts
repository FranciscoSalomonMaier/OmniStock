import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductPurchasePrice1800000000500 implements MigrationInterface {
  name = 'AddProductPurchasePrice1800000000500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "products" ADD COLUMN "purchase_price" decimal(15,2) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "products" DROP COLUMN "purchase_price"',
    );
  }
}
