// Real migrations and product service in a disposable local PostgreSQL database.
require('reflect-metadata');
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ProductsService } = require('../../src/products/products.service');
const { Product } = require('../../src/products/entities/product.entity');
const { ProductCategory } = require('../../src/products/entities/product-category.entity');
const { ProductImage } = require('../../src/products/entities/product-image.entity');
const { AllowSharedProductBarcodes1800000000600 } = require('../../src/database/migrations/1800000000600-AllowSharedProductBarcodes');
const url = process.env.PRODUCT_REMOVAL_TEST_DATABASE_URL;
if (!url) throw Error('Set PRODUCT_REMOVAL_TEST_DATABASE_URL to a disposable local PostgreSQL');
const parsed = new URL(url);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw Error('Only local test PostgreSQL is allowed');
const name = 'product_removal_' + randomUUID().replaceAll('-', '');
const admin = new Client({ connectionString: url });
let db, created = false;
(async () => {
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    parsed.pathname = '/' + name;
    db = new DataSource({
      type: 'postgres', url: parsed.toString(), synchronize: false,
      entities: [__dirname + '/../../src/**/*.entity.ts'],
      migrations: [__dirname + '/../../src/database/migrations/*.ts'],
    });
    await db.initialize();
    await db.runMigrations();
    const columns = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='companies' AND is_nullable='NO' AND column_default IS NULL");
    const values = {};
    for (const c of columns) {
      values[c.column_name] = c.data_type === 'uuid' ? randomUUID() : c.data_type.includes('timestamp') ? new Date() : c.data_type === 'boolean' ? true : 'test';
      if(c.data_type === 'USER-DEFINED') values[c.column_name] = (await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',[c.udt_name]))[0].enumlabel;
    }
    const keys = Object.keys(values);
    const company = (await db.query(`INSERT INTO companies (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(values)))[0].id;
    const { ProductRemovalService } = require('../../src/products/product-removal.service');
    const { ProductBundle } = require('../../src/product_bundles/entities/product_bundle.entity');
    const { ProductBundleComponent } = require('../../src/product_bundle_components/entities/product_bundle_component.entity');
    const { BundlesCompositionService } = require('../../src/product_bundles/bundles-composition/bundles-composition.service');
    const removal = new ProductRemovalService(db,new BundlesCompositionService(db),{remove:async()=>{}});
    const products=db.getRepository(Product),bundles=db.getRepository(ProductBundle),components=db.getRepository(ProductBundleComponent);
    const make=async sku=>products.save(products.create({companyId:company,sku,name:sku,unitOfMeasure:'UN',minimumStock:'0',salePrice:null,status:'ACTIVE'}));
    const unit=await make('UNIT'),kit=await make('KIT3'),outer=await make('OUTER');
    const b=await bundles.save(bundles.create({companyId:company,bundleProductId:kit.id,active:true}));
    const b2=await bundles.save(bundles.create({companyId:company,bundleProductId:outer.id,active:true}));
    await components.save(components.create({companyId:company,bundleId:b.id,componentProductId:unit.id,quantity:3,active:true}));
    await components.save(components.create({companyId:company,bundleId:b2.id,componentProductId:kit.id,quantity:2,active:true}));
    const blocked=await removal.check(company,unit.id);assert.equal(blocked.allowed,false);assert.equal(blocked.kits[0].sku,'KIT3');
    await assert.rejects(removal.remove(company,unit.id,randomUUID()),/vinculado/);
    await assert.rejects(removal.remove(company,kit.id,randomUUID()),/vinculado/);
    await assert.rejects(removal.check(randomUUID(),unit.id),/não encontrado/);
    await assert.rejects(removal.remove(randomUUID(),unit.id,randomUUID()),/não encontrado/);
    await removal.remove(company,outer.id,randomUUID());
    await removal.remove(company,kit.id,randomUUID());
    assert.equal((await removal.check(company,unit.id)).allowed,true);
    await removal.remove(company,unit.id,randomUUID());
    assert.equal(await products.countBy({companyId:company}),0);
    // Repeat the kit check on DELETE, even after a successful preflight.
    const raceUnit=await make('RACE'),raceKit=await make('RACEKIT');
    assert.equal((await removal.check(company,raceUnit.id)).allowed,true);
    const rb=await bundles.save(bundles.create({companyId:company,bundleProductId:raceKit.id,active:true}));
    await components.save(components.create({companyId:company,bundleId:rb.id,componentProductId:raceUnit.id,quantity:1,active:true}));
    await assert.rejects(removal.remove(company,raceUnit.id,randomUUID()),/vinculado/);
    // Nonzero stock cannot be removed, and remains intact.
    const stock=await make('STOCK');
    await db.query('INSERT INTO inventory_balances(company_id,product_id,current_quantity,reserved_quantity) VALUES($1,$2,5,0)',[company,stock.id]);
    assert.equal((await removal.check(company,stock.id)).reason,'HAS_DEPENDENCIES');
    await assert.rejects(removal.remove(company,stock.id,randomUUID()),/histórico/);
    assert.equal(Number((await db.query('SELECT current_quantity FROM inventory_balances WHERE product_id=$1',[stock.id]))[0].current_quantity),5);
    // Unknown FK blockers must roll back the composition cleanup as well.
    await db.query('CREATE TABLE removal_history_probe(product_id uuid REFERENCES products(id) ON DELETE RESTRICT)');
    await db.query('INSERT INTO removal_history_probe(product_id) VALUES($1)',[raceKit.id]);
    await assert.rejects(removal.remove(company,raceKit.id,randomUUID()),/histórico/);
    assert.equal(await components.countBy({bundleId:rb.id}),1);
    assert.equal(await bundles.countBy({id:rb.id}),1);
    console.log('PASS kit warnings, nested kit removal, tenant isolation, delete recheck, stock preservation and FK rollback');
  } finally {
    if(db?.isInitialized) await db.destroy();
    if(created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
