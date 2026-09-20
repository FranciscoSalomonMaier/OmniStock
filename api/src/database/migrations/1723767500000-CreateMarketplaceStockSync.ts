import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateMarketplaceStockSync1723767500000 implements MigrationInterface {
  name = 'CreateMarketplaceStockSync1723767500000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE outbox_event_status_enum AS ENUM('PENDING','PROCESSING','PROCESSED','RETRYING','FAILED'); CREATE TYPE stock_sync_status_enum AS ENUM('PENDING','PROCESSING','SUCCESS','RETRYING','FAILED','SKIPPED','SUPERSEDED','CANCELLED'); CREATE TYPE stock_divergence_status_enum AS ENUM('OPEN','RESOLVED','IGNORED')`,
    );
    await q.query(
      `ALTER TABLE inventory_balances ADD CONSTRAINT chk_inventory_non_negative CHECK(current_quantity>=0 AND reserved_quantity>=0 AND reserved_quantity<=current_quantity)`,
    );
    await q.query(
      `CREATE TABLE outbox_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,aggregate_type varchar(60) NOT NULL,aggregate_id uuid NOT NULL,event_type varchar(100) NOT NULL,payload jsonb NOT NULL,status outbox_event_status_enum NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL,processed_at timestamptz,last_error varchar(500),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX idx_outbox_pending ON outbox_events(status,available_at); CREATE INDEX idx_outbox_aggregate ON outbox_events(company_id,aggregate_id,created_at)`,
    );
    await q.query(
      `CREATE TABLE marketplace_stock_syncs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,product_marketplace_link_id uuid NOT NULL REFERENCES product_marketplace_links(id) ON DELETE RESTRICT,marketplace_account_id uuid NOT NULL REFERENCES sales_channel_connections(id) ON DELETE RESTRICT,marketplace sales_channels_code_enum NOT NULL,external_product_id varchar(80) NOT NULL,external_variation_id varchar(80),inventory_event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE RESTRICT,inventory_version integer NOT NULL,requested_quantity integer NOT NULL CHECK(requested_quantity>=0),sent_quantity integer CHECK(sent_quantity>=0),external_quantity integer CHECK(external_quantity>=0),status stock_sync_status_enum NOT NULL,attempt_count integer NOT NULL DEFAULT 0,source varchar(60) NOT NULL,correlation_id uuid NOT NULL,external_request_id varchar(160),requested_at timestamptz NOT NULL,synchronized_at timestamptz,next_retry_at timestamptz,failed_at timestamptz,last_error_code varchar(80),last_error_message varchar(500),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(product_marketplace_link_id,inventory_version)); CREATE INDEX idx_stock_sync_company_status ON marketplace_stock_syncs(company_id,status,created_at DESC); CREATE INDEX idx_stock_sync_product_version ON marketplace_stock_syncs(company_id,product_id,inventory_version DESC); CREATE INDEX idx_stock_sync_account ON marketplace_stock_syncs(company_id,marketplace_account_id,created_at DESC)`,
    );
    await q.query(
      `CREATE TABLE marketplace_stock_divergences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,product_marketplace_link_id uuid NOT NULL REFERENCES product_marketplace_links(id) ON DELETE RESTRICT,marketplace_account_id uuid NOT NULL REFERENCES sales_channel_connections(id) ON DELETE RESTRICT,expected_quantity integer NOT NULL,external_quantity integer,status stock_divergence_status_enum NOT NULL DEFAULT 'OPEN',detected_at timestamptz NOT NULL,resolved_at timestamptz,resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,resolution varchar(60),notes text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX idx_stock_divergence_open ON marketplace_stock_divergences(company_id,status,detected_at DESC)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP TABLE marketplace_stock_divergences; DROP TABLE marketplace_stock_syncs; DROP TABLE outbox_events; ALTER TABLE inventory_balances DROP CONSTRAINT chk_inventory_non_negative; DROP TYPE stock_divergence_status_enum; DROP TYPE stock_sync_status_enum; DROP TYPE outbox_event_status_enum`,
    );
  }
}
