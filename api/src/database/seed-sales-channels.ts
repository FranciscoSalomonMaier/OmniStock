import 'dotenv/config';
import dataSource from './data-source';
const channels = [['MERCADO_LIVRE','Mercado Livre','MARKETPLACE',true],['SHOPEE','Shopee','MARKETPLACE',true],['AMAZON','Amazon','MARKETPLACE',true],['MAGALU','Magalu','MARKETPLACE',true],['OWN_STORE','Loja própria','ECOMMERCE',false],['MANUAL','Venda manual','MANUAL',false],['CUSTOM','Integração personalizada','CUSTOM',false]] as const;
async function seed() {
  await dataSource.initialize();
  for (const [code,name,type,oauth] of channels) await dataSource.query(`INSERT INTO sales_channels(code,name,type,description,icon_key,supports_oauth,supports_products,supports_orders,supports_stock,supports_prices,is_active) VALUES($1,$2,$3,$4,$5,$6,true,true,true,true,true) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,description=EXCLUDED.description,icon_key=EXCLUDED.icon_key,supports_oauth=EXCLUDED.supports_oauth,is_active=true,updated_at=now()`,[code,name,type,`Canal ${name} preparado para integração futura.`,code,oauth]);
  await dataSource.destroy();
}
seed().catch((error)=>{ console.error(error); process.exit(1); });
