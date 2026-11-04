import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOAuthPkceVerifier1800000000700 implements MigrationInterface {
  name = 'AddOAuthPkceVerifier1800000000700';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "oauth_authorization_states" ADD COLUMN "encrypted_code_verifier" jsonb NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "oauth_authorization_states" DROP COLUMN "encrypted_code_verifier"',
    );
  }
}
