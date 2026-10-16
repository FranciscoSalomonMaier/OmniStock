import { MigrationInterface, QueryRunner } from 'typeorm';
export class EvolveMarketplaceWebhooks1800000000200 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE marketplace_webhook_account_cooldowns(account_id uuid PRIMARY KEY REFERENCES sales_channel_connections(id) ON DELETE CASCADE,blocked_until timestamptz NOT NULL)`,
    );
    await q.query(
      `ALTER TABLE marketplace_webhook_events ADD COLUMN external_account_id varchar(80),ADD COLUMN topic varchar(80),ADD COLUMN external_resource_id varchar(100),ADD COLUMN external_product_id varchar(100),ADD COLUMN external_shipment_id varchar(100),ADD COLUMN headers_metadata jsonb NOT NULL DEFAULT '{}',ADD COLUMN correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),ADD COLUMN occurred_at timestamptz,ADD COLUMN processing_started_at timestamptz,ADD COLUMN next_retry_at timestamptz,ADD COLUMN last_error_code varchar(80),ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0,ADD COLUMN queue_generation integer NOT NULL DEFAULT 0,ADD COLUMN admin_actions jsonb NOT NULL DEFAULT '[]',ADD COLUMN processing_result jsonb`,
    );
    await q.query(
      `UPDATE marketplace_webhook_events SET external_account_id=COALESCE(payload->>'user_id','legacy-'||id::text),topic=event_type,external_resource_id=external_order_id,event_type=CASE WHEN external_order_id IS NOT NULL THEN 'ORDER_UPDATED' ELSE 'UNKNOWN' END,payload=jsonb_build_object('resource',resource,'topic',event_type,'user_id',payload->>'user_id','application_id',payload->>'application_id','_id',external_event_id,'sent',payload->'sent','received',payload->'received','attempts',payload->'attempts'),last_error=CASE WHEN last_error IS NOT NULL THEN 'Erro legado; consulte o histórico.' ELSE NULL END`,
    );
    await q.query(
      `ALTER TABLE marketplace_webhook_events ALTER COLUMN external_account_id SET NOT NULL`,
    );
    const indices = (await q.query(
      `SELECT indexname FROM pg_indexes WHERE tablename='marketplace_webhook_events' AND indexdef LIKE '%UNIQUE%' AND (indexdef LIKE '%external_event_id%' OR indexdef LIKE '%payload_hash%')`,
    )) as { indexname: string }[];
    for (const i of indices)
      await q.query(`DROP INDEX "${i.indexname.replace(/"/g, '""')}"`);
    await q.query(
      `CREATE UNIQUE INDEX uq_webhook_external ON marketplace_webhook_events(marketplace,external_account_id,external_event_id) WHERE external_event_id IS NOT NULL;CREATE UNIQUE INDEX uq_webhook_hash ON marketplace_webhook_events(marketplace,external_account_id,payload_hash);CREATE INDEX idx_webhook_company_date ON marketplace_webhook_events(company_id,received_at DESC);CREATE INDEX idx_webhook_account ON marketplace_webhook_events(marketplace,marketplace_account_id,event_type);CREATE INDEX idx_webhook_pending ON marketplace_webhook_events(status,next_retry_at,updated_at);CREATE INDEX idx_webhook_resource ON marketplace_webhook_events(company_id,external_resource_id);CREATE UNIQUE INDEX uq_connection_company_id ON sales_channel_connections(company_id,id);ALTER TABLE marketplace_webhook_events ADD CONSTRAINT webhook_company_fk FOREIGN KEY(company_id) REFERENCES companies(id),ADD CONSTRAINT webhook_company_account_fk FOREIGN KEY(company_id,marketplace_account_id) REFERENCES sales_channel_connections(company_id,id),ADD CONSTRAINT webhook_account_company_check CHECK(marketplace_account_id IS NULL OR company_id IS NOT NULL)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(`DROP TABLE marketplace_webhook_account_cooldowns`);
    await q.query(
      `UPDATE marketplace_webhook_events SET event_type=COALESCE(topic,event_type)`,
    );
    await q.query(
      `ALTER TABLE marketplace_webhook_events DROP CONSTRAINT webhook_company_fk,DROP CONSTRAINT webhook_company_account_fk,DROP CONSTRAINT webhook_account_company_check;DROP INDEX uq_connection_company_id;DROP INDEX uq_webhook_external;DROP INDEX uq_webhook_hash;DROP INDEX idx_webhook_company_date;DROP INDEX idx_webhook_account;DROP INDEX idx_webhook_pending;DROP INDEX idx_webhook_resource`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_webhook_legacy_external ON marketplace_webhook_events(marketplace,external_event_id) WHERE external_event_id IS NOT NULL;CREATE UNIQUE INDEX uq_webhook_legacy_hash ON marketplace_webhook_events(marketplace,payload_hash)`,
    );
    await q.query(
      `ALTER TABLE marketplace_webhook_events DROP COLUMN external_account_id,DROP COLUMN topic,DROP COLUMN external_resource_id,DROP COLUMN external_product_id,DROP COLUMN external_shipment_id,DROP COLUMN headers_metadata,DROP COLUMN correlation_id,DROP COLUMN occurred_at,DROP COLUMN processing_started_at,DROP COLUMN next_retry_at,DROP COLUMN last_error_code,DROP COLUMN duplicate_count,DROP COLUMN queue_generation,DROP COLUMN admin_actions,DROP COLUMN processing_result`,
    );
  }
}
