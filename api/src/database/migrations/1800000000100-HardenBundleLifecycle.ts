import { MigrationInterface, QueryRunner } from 'typeorm';
export class HardenBundleLifecycle1800000000100 implements MigrationInterface {
  name = 'HardenBundleLifecycle1800000000100';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bundle_active_product" ON product_bundles(company_id,bundle_product_id) WHERE active`,
    );
    for (const table of ['products', 'product_bundles', 'order_items'])
      await q.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_${table}_company_id" ON "${table}"(company_id,id)`,
      );
    await q.query(
      `ALTER TABLE product_bundles ADD CONSTRAINT bundle_company_product_fk FOREIGN KEY(company_id,bundle_product_id) REFERENCES products(company_id,id)`,
    );
    await q.query(
      `ALTER TABLE product_bundle_components ADD CONSTRAINT component_company_bundle_fk FOREIGN KEY(company_id,bundle_id) REFERENCES product_bundles(company_id,id),ADD CONSTRAINT component_company_product_fk FOREIGN KEY(company_id,component_product_id) REFERENCES products(company_id,id)`,
    );
    await q.query(
      `ALTER TABLE order_item_components ADD CONSTRAINT snapshot_company_item_fk FOREIGN KEY(company_id,order_item_id) REFERENCES order_items(company_id,id), ADD CONSTRAINT snapshot_company_product_fk FOREIGN KEY(company_id,component_product_id) REFERENCES products(company_id,id), ADD CONSTRAINT snapshot_quantity_positive CHECK(quantity_per_bundle>0 AND quantity_consumed>0)`,
    );
    // Preserve duplicate legacy rows for audit instead of silently discarding them.
    await q.query(
      `CREATE TABLE order_item_components_legacy_duplicates AS SELECT c.* FROM order_item_components c JOIN (SELECT id,row_number() OVER(PARTITION BY company_id,order_item_id,component_product_id ORDER BY created_at,id) n FROM order_item_components) d ON d.id=c.id WHERE d.n>1`,
    );
    await q.query(
      `DELETE FROM order_item_components WHERE id IN(SELECT id FROM order_item_components_legacy_duplicates)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_snapshot_component" ON order_item_components(company_id,order_item_id,component_product_id)`,
    );
    await q.query(
      `ALTER TABLE order_items ADD COLUMN stock_snapshot_created boolean NOT NULL DEFAULT false,ADD COLUMN stock_sold_quantity numeric(15,3)`,
    );
    await q.query(
      `DO $$ BEGIN IF EXISTS(WITH RECURSIVE paths(company_id,root,id,visited,cycle) AS (SELECT b.company_id,b.bundle_product_id,c.component_product_id,ARRAY[b.bundle_product_id],b.bundle_product_id=c.component_product_id FROM product_bundles b JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=b.company_id WHERE b.active AND c.active UNION ALL SELECT p.company_id,p.root,c.component_product_id,p.visited||p.id,c.component_product_id=ANY(p.visited||p.id) FROM paths p JOIN product_bundles b ON b.company_id=p.company_id AND b.bundle_product_id=p.id AND b.active JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=p.company_id AND c.active WHERE NOT p.cycle) SELECT 1 FROM paths WHERE cycle) THEN RAISE EXCEPTION 'Composições existentes possuem ciclos; corrija antes da migration'; END IF; END $$`,
    );
    await q.query(`CREATE FUNCTION available_product_stock(c uuid,p uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
    WITH RECURSIVE expansion(id,qty,path) AS (SELECT p,1::numeric,ARRAY[p] UNION ALL
      SELECT child.component_product_id,e.qty*child.quantity,e.path||child.component_product_id FROM expansion e JOIN product_bundles b ON b.company_id=c AND b.bundle_product_id=e.id AND b.active JOIN product_bundle_components child ON child.bundle_id=b.id AND child.company_id=c AND child.active WHERE NOT child.component_product_id=ANY(e.path)),
    leaves AS (SELECT e.id,SUM(e.qty) qty FROM expansion e WHERE NOT EXISTS(SELECT 1 FROM product_bundles b WHERE b.company_id=c AND b.bundle_product_id=e.id AND b.active) GROUP BY e.id),
    limits AS (SELECT FLOOR(GREATEST(COALESCE(i.current_quantity-i.reserved_quantity,0),0)/l.qty) n FROM leaves l LEFT JOIN inventory_balances i ON i.company_id=c AND i.product_id=l.id)
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM product_bundles WHERE company_id=c AND bundle_product_id=p AND active) THEN COALESCE((SELECT current_quantity-reserved_quantity FROM inventory_balances WHERE company_id=c AND product_id=p),0)
      WHEN EXISTS(SELECT 1 FROM expansion e JOIN products pr ON pr.id=e.id AND pr.company_id=c WHERE pr.status<>'ACTIVE') OR EXISTS(SELECT 1 FROM expansion e JOIN product_bundles b ON b.company_id=c AND b.bundle_product_id=e.id AND b.active WHERE NOT EXISTS(SELECT 1 FROM product_bundle_components child WHERE child.company_id=c AND child.bundle_id=b.id AND child.active)) THEN 0
      ELSE COALESCE((SELECT MIN(n) FROM limits),0) END;
    $$`);
    await q.query(`CREATE FUNCTION validate_bundle_component() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE root uuid; BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('bundle:'||NEW.company_id::text,0));
    SELECT bundle_product_id INTO root FROM product_bundles WHERE id=NEW.bundle_id AND company_id=NEW.company_id;
    IF NEW.active AND (NEW.component_product_id=root OR EXISTS(WITH RECURSIVE descendants(id) AS (
      SELECT NEW.component_product_id UNION SELECT c.component_product_id FROM descendants d JOIN product_bundles b ON b.bundle_product_id=d.id AND b.company_id=NEW.company_id AND b.active JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=NEW.company_id AND c.active WHERE c.id<>NEW.id)
      SELECT 1 FROM descendants WHERE id=root)) THEN RAISE EXCEPTION 'Composição circular' USING ERRCODE='23514'; END IF;
    RETURN NEW; END $$`);
    await q.query(
      `CREATE TRIGGER bundle_component_cycle BEFORE INSERT OR UPDATE ON product_bundle_components FOR EACH ROW EXECUTE FUNCTION validate_bundle_component()`,
    );
    await q.query(`CREATE FUNCTION reject_bundle_physical_balance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF (NEW.current_quantity<>0 OR NEW.reserved_quantity<>0) AND EXISTS(SELECT 1 FROM product_bundles WHERE company_id=NEW.company_id AND bundle_product_id=NEW.product_id AND active) THEN RAISE EXCEPTION 'Kit não possui estoque físico independente' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
    await q.query(
      `CREATE TRIGGER bundle_no_physical_balance BEFORE INSERT OR UPDATE ON inventory_balances FOR EACH ROW EXECUTE FUNCTION reject_bundle_physical_balance()`,
    );
    await q.query(`CREATE FUNCTION reject_bundle_with_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('bundle:'||NEW.company_id::text,0));
    IF NEW.active AND EXISTS(WITH RECURSIVE descendants(id) AS (SELECT c.component_product_id FROM product_bundle_components c WHERE c.bundle_id=NEW.id AND c.company_id=NEW.company_id AND c.active UNION SELECT c.component_product_id FROM descendants d JOIN product_bundles b ON b.bundle_product_id=d.id AND b.company_id=NEW.company_id AND b.active JOIN product_bundle_components c ON c.bundle_id=b.id AND c.company_id=NEW.company_id AND c.active) SELECT 1 FROM descendants WHERE id=NEW.bundle_product_id) THEN RAISE EXCEPTION 'Composição circular' USING ERRCODE='23514'; END IF;
    IF NEW.active AND (EXISTS(SELECT 1 FROM inventory_balances WHERE company_id=NEW.company_id AND product_id=NEW.bundle_product_id AND (current_quantity<>0 OR reserved_quantity<>0)) OR EXISTS(SELECT 1 FROM inventory_movements WHERE company_id=NEW.company_id AND product_id=NEW.bundle_product_id)) THEN RAISE EXCEPTION 'Crie um produto comercial separado para o kit' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
    await q.query(
      `CREATE TRIGGER bundle_no_stock_before_activation BEFORE INSERT OR UPDATE ON product_bundles FOR EACH ROW EXECUTE FUNCTION reject_bundle_with_stock()`,
    );
    await q.query(
      `DO $$ BEGIN IF EXISTS(SELECT 1 FROM product_bundles b JOIN inventory_balances i ON i.company_id=b.company_id AND i.product_id=b.bundle_product_id WHERE b.active AND (i.current_quantity<>0 OR i.reserved_quantity<>0)) THEN RAISE EXCEPTION 'Kits existentes com estoque próprio exigem correção antes da migration'; END IF; END $$`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP FUNCTION available_product_stock(uuid,uuid);DROP TRIGGER bundle_no_stock_before_activation ON product_bundles;DROP FUNCTION reject_bundle_with_stock();DROP TRIGGER bundle_no_physical_balance ON inventory_balances;DROP FUNCTION reject_bundle_physical_balance();DROP TRIGGER bundle_component_cycle ON product_bundle_components;DROP FUNCTION validate_bundle_component();`,
    );
    await q.query(
      `ALTER TABLE order_items DROP COLUMN stock_snapshot_created,DROP COLUMN stock_sold_quantity;DROP INDEX "UQ_snapshot_component";INSERT INTO order_item_components SELECT * FROM order_item_components_legacy_duplicates;DROP TABLE order_item_components_legacy_duplicates;`,
    );
    await q.query(
      `ALTER TABLE order_item_components DROP CONSTRAINT snapshot_company_item_fk,DROP CONSTRAINT snapshot_company_product_fk,DROP CONSTRAINT snapshot_quantity_positive;ALTER TABLE product_bundle_components DROP CONSTRAINT component_company_bundle_fk,DROP CONSTRAINT component_company_product_fk;ALTER TABLE product_bundles DROP CONSTRAINT bundle_company_product_fk;DROP INDEX "UQ_bundle_active_product";`,
    );
    for (const table of ['products', 'product_bundles', 'order_items'])
      await q.query(`DROP INDEX "UQ_${table}_company_id"`);
  }
}
