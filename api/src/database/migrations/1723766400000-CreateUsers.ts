import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1723766400000 implements MigrationInterface {
  name = 'CreateUsers1723766400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'MANAGER', 'STOCKIST', 'BILLING', 'SUPPORT', 'VIEWER')`,
    );
    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" character varying(120) NOT NULL,
      "email" character varying(255) NOT NULL,
      "password_hash" character varying NOT NULL,
      "role" "public"."users_role_enum" NOT NULL DEFAULT 'VIEWER',
      "is_active" boolean NOT NULL DEFAULT true,
      "refresh_token_hash" character varying,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_users_email" UNIQUE ("email"),
      CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "public"."users_role_enum"');
  }
}
