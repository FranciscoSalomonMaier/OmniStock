import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderItemComponents1800000000000 implements MigrationInterface {
  name = 'CreateOrderItemComponents1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_item_components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "component_product_id" uuid NOT NULL,
        "quantity_per_bundle" numeric(15,3) NOT NULL,
        "quantity_consumed" numeric(15,3) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_item_components" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "order_item_components"
      ADD CONSTRAINT "FK_order_item_components_order_item"
      FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "order_item_components"
      ADD CONSTRAINT "FK_order_item_components_component_product"
      FOREIGN KEY ("component_product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_order_item_components_order_item"
      ON "order_item_components" ("order_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item_components" DROP CONSTRAINT "FK_order_item_components_component_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_components" DROP CONSTRAINT "FK_order_item_components_order_item"`,
    );
    await queryRunner.query(`DROP TABLE "order_item_components"`);
  }
}
