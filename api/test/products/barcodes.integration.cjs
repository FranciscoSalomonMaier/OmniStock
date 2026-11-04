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
const url = process.env.PRODUCTS_TEST_DATABASE_URL;
if (!url) throw Error('Set PRODUCTS_TEST_DATABASE_URL to a disposable local PostgreSQL');
const parsed = new URL(url);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw Error('Only local test PostgreSQL is allowed');
const name = 'product_barcodes_' + randomUUID().replaceAll('-', '');
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
    for (let i = 0; i < 20; i++) {
      const [last] = await db.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1');
      if (!last) throw Error('Barcode migration not found');
      await db.undoLastMigration();
      if (last.name === 'AllowSharedProductBarcodes1800000000600') break;
      if (i === 19) throw Error('Barcode rollback limit exceeded');
    }
    const columns = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='companies' AND is_nullable='NO' AND column_default IS NULL");
    const values = {};
    for (const c of columns) {
      values[c.column_name] = c.data_type === 'uuid' ? randomUUID() : c.data_type.includes('timestamp') ? new Date() : c.data_type === 'boolean' ? true : 'test';
      if(c.data_type === 'USER-DEFINED') values[c.column_name] = (await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',[c.udt_name]))[0].enumlabel;
    }
    const keys = Object.keys(values);
    const company = (await db.query(`INSERT INTO companies (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(values)))[0].id;
    const service = new ProductsService(db.getRepository(Product), db.getRepository(ProductCategory), db.getRepository(ProductImage), {}, {}, {describe:async()=>({})});
    const base = {name:'Produto', unitOfMeasure:'UN', minimumStock:'0', barcode:'7891234567895'};
    const unit = await service.create(company, randomUUID(), {...base, sku:'UNIT', purchasePrice:'2.00',costPrice:'2.50'});
    await db.runMigrations();
    const kit = await service.create(company, randomUUID(), {...base, sku:'KIT3', unitOfMeasure:'KIT'});
    assert.notEqual(unit.id,kit.id);
    await service.update(company,kit.id,randomUUID(),{barcode:base.barcode,name:'Kit com 3 unidades'});
    const result = await service.list(company,'ADMIN',{page:1,limit:20,sortBy:'name',sortDirection:'asc',barcode:base.barcode});
    assert.equal(result.data.length,2);
    assert.equal((await db.getRepository(Product).findOneByOrFail({id:unit.id})).costPrice,'2.50');
    await assert.rejects(service.create(company,randomUUID(),{...base,sku:'UNIT'}),/SKU/);
    await assert.rejects(service.create(company,randomUUID(),{...base,sku:'INVALID',barcode:'7891234567890'}),/barras inválido/);
    const runner = db.createQueryRunner();
    try {
      await assert.rejects(new AllowSharedProductBarcodes1800000000600().down(runner));
    } finally { await runner.release(); }
    assert.equal(await db.getRepository(Product).countBy({companyId:company}),2);
    console.log('PASS existing data preserved, shared barcode creation/update/search, unique SKU, barcode validation, rollback refuses duplicates');
  } finally {
    if(db?.isInitialized) await db.destroy();
    if(created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
