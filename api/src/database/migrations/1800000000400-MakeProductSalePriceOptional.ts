import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProductSalePriceOptional1800000000400 implements MigrationInterface {
  name = 'MakeProductSalePriceOptional1800000000400';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "products" ALTER COLUMN "sale_price" DROP NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse rollback if null prices exist; do not invent prices or delete products.
    await queryRunner.query(
      'ALTER TABLE "products" ALTER COLUMN "sale_price" SET NOT NULL',
    );
  }
}
