import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateMarketplaceOrderFlow1723767400000 implements MigrationInterface {
  name = 'CreateMarketplaceOrderFlow1723767400000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE order_processing_status_enum AS ENUM('RECEIVED','IMPORTING','PENDING_PRODUCT_LINK','PENDING_STOCK','READY_FOR_BILLING','PROCESSING_ERROR'); CREATE TYPE billing_outbox_status_enum AS ENUM('PENDING','PUBLISHED','FAILED'); CREATE TYPE marketplace_webhook_event_status_enum AS ENUM('RECEIVED','QUEUED','PROCESSING','PROCESSED','IGNORED','RETRYING','FAILED','DEAD_LETTER')`,
    );
    await q.query(
      `ALTER TYPE order_issue_code_enum ADD VALUE IF NOT EXISTS 'AMBIGUOUS_PRODUCT_LINK'; ALTER TYPE order_issue_code_enum ADD VALUE IF NOT EXISTS 'INSUFFICIENT_STOCK'; ALTER TYPE order_issue_code_enum ADD VALUE IF NOT EXISTS 'MARKETPLACE_API_ERROR'; ALTER TYPE order_issue_code_enum ADD VALUE IF NOT EXISTS 'TOKEN_ERROR'; ALTER TYPE order_issue_code_enum ADD VALUE IF NOT EXISTS 'IMPORT_ERROR'`,
    );
    await q.query(
      `ALTER TABLE orders ADD COLUMN processing_status order_processing_status_enum NOT NULL DEFAULT 'RECEIVED', ADD COLUMN billing_queued_at timestamptz; ALTER TABLE order_items ADD COLUMN inventory_reservation_id uuid REFERENCES inventory_reservations(id) ON DELETE RESTRICT`,
    );
    await q.query(
      `CREATE INDEX idx_orders_processing ON orders(company_id,processing_status,updated_at); CREATE INDEX idx_order_items_reservation ON order_items(company_id,inventory_reservation_id)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_order_item_external_target ON order_items(company_id,order_id,external_item_id,COALESCE(external_variation_id,'')) WHERE external_item_id IS NOT NULL`,
    );
    await q.query(
      `CREATE TABLE marketplace_webhook_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid REFERENCES companies(id) ON DELETE RESTRICT,marketplace_account_id uuid REFERENCES sales_channel_connections(id) ON DELETE RESTRICT,marketplace sales_channels_code_enum NOT NULL,external_event_id varchar(120),event_type varchar(80) NOT NULL,resource varchar(500) NOT NULL,external_order_id varchar(100),payload jsonb NOT NULL,payload_hash varchar(64) NOT NULL,status marketplace_webhook_event_status_enum NOT NULL,attempts integer NOT NULL DEFAULT 0,received_at timestamptz NOT NULL,queued_at timestamptz,processed_at timestamptz,failed_at timestamptz,last_error varchar(500),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_webhook_external_event ON marketplace_webhook_events(marketplace,external_event_id) WHERE external_event_id IS NOT NULL; CREATE UNIQUE INDEX uq_webhook_payload_hash ON marketplace_webhook_events(marketplace,payload_hash); CREATE INDEX idx_webhook_company_status ON marketplace_webhook_events(company_id,status,received_at DESC); CREATE INDEX idx_webhook_account_order ON marketplace_webhook_events(marketplace_account_id,external_order_id)`,
    );
    await q.query(
      `CREATE TABLE marketplace_order_sync_states(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,marketplace_account_id uuid NOT NULL REFERENCES sales_channel_connections(id) ON DELETE RESTRICT,last_successful_at timestamptz,cursor text,lock_until timestamptz,last_error varchar(500),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(company_id,marketplace_account_id)); CREATE INDEX idx_order_sync_due ON marketplace_order_sync_states(lock_until,last_successful_at)`,
    );
    await q.query(
      `CREATE TABLE order_billing_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,correlation_id uuid NOT NULL,status billing_outbox_status_enum NOT NULL,payload jsonb NOT NULL,attempts integer NOT NULL DEFAULT 0,published_at timestamptz,last_error varchar(500),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(company_id,order_id)); CREATE INDEX idx_billing_outbox_pending ON order_billing_outbox(status,created_at)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP TABLE order_billing_outbox; DROP TABLE marketplace_order_sync_states; DROP TABLE marketplace_webhook_events; DROP INDEX uq_order_item_external_target; DROP INDEX idx_order_items_reservation; DROP INDEX idx_orders_processing; ALTER TABLE order_items DROP COLUMN inventory_reservation_id; ALTER TABLE orders DROP COLUMN billing_queued_at,DROP COLUMN processing_status; DROP TYPE marketplace_webhook_event_status_enum; DROP TYPE billing_outbox_status_enum; DROP TYPE order_processing_status_enum`,
    );
  }
}
