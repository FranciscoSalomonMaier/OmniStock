import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateMercadoLivreOAuthState1723767000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TYPE "sales_channel_connections_status_enum" ADD VALUE IF NOT EXISTS 'CONNECTING'`,
    );
    await q.query(
      `ALTER TYPE "sales_channel_connections_status_enum" ADD VALUE IF NOT EXISTS 'CONNECTED'`,
    );
    await q.query(
      `CREATE TABLE "oauth_authorization_states"("id" uuid NOT NULL DEFAULT gen_random_uuid(),"state_hash" varchar(64) NOT NULL,"company_id" uuid NOT NULL,"connection_id" uuid NOT NULL,"user_id" uuid NOT NULL,"channel_code" "sales_channels_code_enum" NOT NULL,"return_path" varchar(240) NOT NULL,"expires_at" timestamptz NOT NULL,"consumed_at" timestamptz,"created_at" timestamptz NOT NULL DEFAULT now(),CONSTRAINT "PK_oauth_authorization_states" PRIMARY KEY("id"),CONSTRAINT "UQ_oauth_state_hash" UNIQUE("state_hash"),CONSTRAINT "FK_oauth_company" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,CONSTRAINT "FK_oauth_connection" FOREIGN KEY("connection_id") REFERENCES "sales_channel_connections"("id") ON DELETE CASCADE,CONSTRAINT "FK_oauth_user" FOREIGN KEY("user_id") REFERENCES "users"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE INDEX "IDX_oauth_state_expiry" ON "oauth_authorization_states"("expires_at","consumed_at")`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "oauth_authorization_states"');
  }
}
