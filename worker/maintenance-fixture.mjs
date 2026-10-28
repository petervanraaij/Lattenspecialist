// Isolated synthetic fixture; never reads production credentials or databases.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';

export async function maintenanceFixture(origin='http://127.0.0.1:8898'){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0001_team.sql','0002_operations.sql','0003_availability_times.sql','0004_inventory_workflow.sql','0005_accounting.sql'])sql.exec(readFileSync(new URL('./team-migrations/'+file,import.meta.url),'utf8'));
 const db={prepare(query){let values=[];return{bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return{results:sql.prepare(query).all(...values)};},async run(){return{meta:sql.prepare(query).run(...values)};},execute(){const statement=sql.prepare(query);return statement.columns().length?{results:statement.all(...values)}:{results:[],meta:statement.run(...values)};}};},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(statement=>statement.execute());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const kv={values:new Map(),async get(key,type){const value=this.values.get(key);return value===undefined?null:type==='json'?JSON.parse(value):value;},async put(key,value){this.values.set(key,String(value));},async list({prefix=''}){return{keys:[...this.values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};}};
 const owner='maintenance-fixture-owner-only',env={LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_RESERVATIONS_KV:kv,LATTENSPECIALIST_ADMIN_TOKEN:owner,LATTENSPECIALIST_ORIGINS:origin};
 async function call(path,method='GET',body,token=owner){const response=await worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);return{status:response.status,data:await response.json()};}
 const member=await call('/api/admin/team/members','POST',{name:'Fictieve onderhoudsmedewerker',login:'guide.fixture'});
 const login=await call('/api/team/login','POST',{login:'guide.fixture',accessKey:member.data.accessKey},'');
 const record={reference:'LS-2610-GUIDEX',name:'Fictieve ski-eigenaar',email:'fixture@example.test',service:'Onderhoud',material:'Meerdere / combinatie',amount:'2',package:'Verschillende gekozen behandelingen',maintenanceSelection:JSON.stringify({p:{zilver:{s:1,b:0,d:0,r:1,c:1,w:'alpha',u:false},platinum:{s:0,b:1,d:1,r:0,c:0,w:'beta',u:true}},e:{},u:false}),waxstickCount:1,currentStep:3,status:'Materiaal ontvangen',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),closedAt:null};
 sql.prepare('INSERT INTO records(reference,payload,assigned_to,updated_at) VALUES(?,?,?,?)').run(record.reference,JSON.stringify(record),member.data.id,record.updatedAt);
 const labels=await call('/api/admin/operations/materials','POST',{reference:record.reference});
 const received=await call('/api/admin/inventory/orders/holmenkol-26-27-2909-v3/receive','POST',{});if(received.status!==200)throw Error('Fixture stock receipt failed');
 return{sql,db,env,owner,member:member.data,staff:login.data.token,materials:labels.data.materials,call,close:()=>sql.close()};
}
