import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductBundles1790520792074 implements MigrationInterface {
  name = 'CreateProductBundles1790520792074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_bundles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "bundle_product_id" uuid NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_90176621a4e93cc30e1f5b2077b" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_bundle_components" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "bundle_id" uuid NOT NULL,
        "component_product_id" uuid NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "quantity" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_358b40a5aa662356c6145266950"
          UNIQUE ("bundle_id", "component_product_id"),
        CONSTRAINT "CHK_6f6ae102811168a7dc2167a55b"
          CHECK ("quantity" > 0),
        CONSTRAINT "PK_17046a55cf69f0b83598129f53f" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_bundles"
        ADD CONSTRAINT "FK_7f5353a047530506a4effb0897e"
        FOREIGN KEY ("bundle_product_id") REFERENCES "products"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_bundle_components"
        ADD CONSTRAINT "FK_c8d5c47e11fa3abebe2d9114e1e"
        FOREIGN KEY ("bundle_id") REFERENCES "product_bundles"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_bundle_components"
        ADD CONSTRAINT "FK_bba455b39f2706e5de1c0e3b1bd"
        FOREIGN KEY ("component_product_id") REFERENCES "products"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_bundle_components"
        DROP CONSTRAINT "FK_bba455b39f2706e5de1c0e3b1bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_bundle_components"
        DROP CONSTRAINT "FK_c8d5c47e11fa3abebe2d9114e1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_bundles"
        DROP CONSTRAINT "FK_7f5353a047530506a4effb0897e"`,
    );
    await queryRunner.query(`DROP TABLE "product_bundle_components"`);
    await queryRunner.query(`DROP TABLE "product_bundles"`);
  }
}
