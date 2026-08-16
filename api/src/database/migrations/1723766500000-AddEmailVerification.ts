import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1723766500000 implements MigrationInterface {
  name = 'AddEmailVerification1723766500000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "email_verification_token_hash" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "email_verification_expires_at" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "email_verification_sent_at" TIMESTAMP',
    );
    await queryRunner.query('UPDATE "users" SET "email_verified_at" = now()');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_users_email_verification_token_hash" ON "users" ("email_verification_token_hash") WHERE "email_verification_token_hash" IS NOT NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_users_email_verification_token_hash"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "email_verification_sent_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "email_verification_expires_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "email_verification_token_hash"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "email_verified_at"',
    );
  }
}
