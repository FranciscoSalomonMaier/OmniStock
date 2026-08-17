import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompaniesAndPasswordReset1723766600000 implements MigrationInterface {
  name = 'AddCompaniesAndPasswordReset1723766600000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "users" ADD "password_reset_token_hash" character varying',
    );
    await q.query(
      'ALTER TABLE "users" ADD "password_reset_expires_at" TIMESTAMP',
    );
    await q.query('ALTER TABLE "users" ADD "password_changed_at" TIMESTAMP');
    await q.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "legal_name" varchar(180) NOT NULL, "trade_name" varchar(180) NOT NULL, "document" varchar(14) NOT NULL, "email" varchar(255), "phone" varchar(30), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_companies_document" UNIQUE ("document"), CONSTRAINT "PK_companies" PRIMARY KEY ("id"))`,
    );
    await q.query(
      `CREATE TYPE "public"."company_members_role_enum" AS ENUM('ADMIN','MANAGER','STOCKIST','BILLING','SUPPORT','VIEWER')`,
    );
    await q.query(
      `CREATE TABLE "company_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."company_members_role_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_member" UNIQUE ("company_id","user_id"), CONSTRAINT "PK_company_members" PRIMARY KEY ("id"), CONSTRAINT "FK_member_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE, CONSTRAINT "FK_member_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await q.query(
      'CREATE INDEX "IDX_company_members_company" ON "company_members" ("company_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_company_members_user" ON "company_members" ("user_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_company_members_company_role" ON "company_members" ("company_id","role")',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "company_members"');
    await q.query('DROP TYPE "public"."company_members_role_enum"');
    await q.query('DROP TABLE "companies"');
    await q.query('ALTER TABLE "users" DROP COLUMN "password_changed_at"');
    await q.query(
      'ALTER TABLE "users" DROP COLUMN "password_reset_expires_at"',
    );
    await q.query(
      'ALTER TABLE "users" DROP COLUMN "password_reset_token_hash"',
    );
  }
}
