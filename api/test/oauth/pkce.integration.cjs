require('reflect-metadata');
require('ts-node/register/transpile-only');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {Client}=require('pg');
const {DataSource}=require('typeorm');
const {ConfigService}=require('@nestjs/config');
const {TokenEncryptionService}=require('../../src/sales-channels/token-encryption.service');
const {MercadoLivreIntegrationService}=require('../../src/marketplace-connectors/mercado-livre/mercado-livre-integration.service');
const {MercadoLivreConnector}=require('../../src/marketplace-connectors/mercado-livre/mercado-livre.connector');
const {OAuthAuthorizationState}=require('../../src/marketplace-connectors/mercado-livre/entities/oauth-authorization-state.entity');
const {SalesChannelConnection}=require('../../src/sales-channels/entities/sales-channel-connection.entity');
const url=process.env.OAUTH_TEST_DATABASE_URL;
if(!url)throw Error('Set OAUTH_TEST_DATABASE_URL to disposable local PostgreSQL');
const parsed=new URL(url);if(!['localhost','127.0.0.1'].includes(parsed.hostname))throw Error('Only local test PostgreSQL is allowed');
const name='oauth_pkce_'+randomUUID().replaceAll('-','');
const admin=new Client({connectionString:url});let db,created=false;
(async()=>{try{
 await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);created=true;parsed.pathname='/'+name;
 db=new DataSource({type:'postgres',url:parsed.toString(),entities:[__dirname+'/../../src/**/*.entity.ts'],migrations:[__dirname+'/../../src/database/migrations/*.ts'],synchronize:false});await db.initialize();await db.runMigrations();
 const create=async(table,data)=>{
  const cols=await db.query("SELECT column_name,data_type,udt_name FROM information_schema.columns WHERE table_name=$1 AND is_nullable='NO' AND column_default IS NULL",[table]);
  for(const c of cols){if(c.column_name in data)continue;data[c.column_name]=c.data_type==='uuid'?randomUUID():c.data_type.includes('timestamp')?new Date():c.data_type==='boolean'?true:['integer','numeric','bigint'].includes(c.data_type)?0:'test';if(c.data_type==='USER-DEFINED')data[c.column_name]=(await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',[c.udt_name]))[0].enumlabel;}
  const keys=Object.keys(data);return(await db.query(`INSERT INTO "${table}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(data)))[0];
 };
 const company=await create('companies',{}),user=await create('users',{email:'pkce@example.test'});
 const channel=await create('sales_channels',{code:'MERCADO_LIVRE'});
 const connection=await create('sales_channel_connections',{company_id:company.id,sales_channel_id:channel.id,created_by_user_id:user.id,status:'PENDING'});
 const config=new ConfigService({FRONTEND_URL:'https://app.example.test',MERCADO_LIVRE_CONNECTOR_ENABLED:true,MERCADO_LIVRE_CLIENT_ID:'test',MERCADO_LIVRE_REDIRECT_URI:'https://app.example.test/api/callback',MARKETPLACE_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64')});
 const encryption=new TokenEncryptionService(config);let exchanges=0,expectedVerifier;
 const api={exchangeAuthorizationCode:async(code,verifier)=>{exchanges++;assert.equal(verifier,expectedVerifier);return{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,user_id:1,scope:'read write'};},getCurrentUser:async()=>({id:1,nickname:'synthetic'})};
 const connector=new MercadoLivreConnector(config,api);
 const states=db.getRepository(OAuthAuthorizationState);
 const service=new MercadoLivreIntegrationService(states,db.getRepository(SalesChannelConnection),db,connector,api,{save:async()=>{}},config,encryption);
 // Migration preserves legacy rows; a pre-PKCE attempt must require reauthorization.
 await db.undoLastMigration();
 const legacy='legacy-state';await create('oauth_authorization_states',{state_hash:createHash('sha256').update(legacy).digest('hex'),company_id:company.id,connection_id:connection.id,user_id:user.id,channel_code:'MERCADO_LIVRE',expires_at:new Date(Date.now()+60000),return_path:'/integrations/mercado-livre/callback'});
 await db.runMigrations();assert.match(await service.callback('synthetic-code',legacy),/AUTHORIZATION_EXPIRED/);assert.equal(exchanges,0);
 const result=await service.authorize(company.id,connection.id,user.id),auth=new URL(result.authorizationUrl),state=auth.searchParams.get('state');
 const row=await states.findOneByOrFail({stateHash:createHash('sha256').update(state).digest('hex')});
 expectedVerifier=encryption.decrypt(row.encryptedCodeVerifier);
 assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('code_challenge'),createHash('sha256').update(expectedVerifier).digest('base64url'));assert.ok(!JSON.stringify(row).includes(expectedVerifier));
 const results=await Promise.all([service.callback('synthetic-code',state),service.callback('synthetic-code',state)]);
 assert.equal(results.filter(x=>new URL(x).searchParams.get('status')==='success').length,1);assert.equal(exchanges,1);
 const used=await states.findOneByOrFail({id:row.id});assert.equal(used.encryptedCodeVerifier,null);assert.ok(used.consumedAt);
 console.log('PASS PKCE encrypted persistence, S256 binding, migration compatibility, concurrent one-time consumption and verifier deletion; no marketplace requests');
 }finally{if(db?.isInitialized)await db.destroy();if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
