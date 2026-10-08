const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Runs the actual HTTP handler. The default double only exercises the contract;
// TEST_DATABASE_URL repeats the same scenarios against PostgreSQL SQL/locking.
async function harness(token='secret', realPool=null) {
  let row=null, handler;
  const queries=[];
  const pool=realPool || {
    async query(sql,args=[]) {
      queries.push(sql);
      if (/CREATE TABLE|ALTER TABLE/.test(sql)) return {rows:[]};
      if (/^SELECT/.test(sql)) return {rows:row?[{...row}]:[]};
      if (/^INSERT/.test(sql)) {
        assert.match(sql,/ON CONFLICT\(key\) DO NOTHING/);
        if(row) return {rows:[]};
        row={data:JSON.parse(args[1]),version:1,updated_at:'now'};
      } else if (/^UPDATE/.test(sql)) {
        assert.match(sql,/WHERE key=\$1 AND version=\$3/);
        if(!row || row.version!==args[2]) return {rows:[]};
        row={data:JSON.parse(args[1]),version:row.version+1,updated_at:'now'};
      } else throw new Error('Unexpected SQL: '+sql);
      return {rows:[{...row}]};
    }
  };
  const context={
    require(name) {
      if(name==='pg') return {Pool:class {constructor(){return pool;}}};
      if(name==='http') return {createServer(fn){handler=fn;return {listen(){}};}};
      return require(name);
    },
    process:{env:{DATABASE_URL:'test',MOJING_ACCESS_TOKEN:token}},
    __dirname:path.resolve(__dirname,'..'),Buffer,console:{log(){},error(){}},fetch
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),context);
  while(!vm.runInNewContext('dbReady',context)) await new Promise(r=>setImmediate(r));
  return async function request(method,url='/api/state',body,credential='secret'){
    const req={method,url,headers:{host:'localhost',...(credential?{'x-mojing-token':credential}:{})},
      async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body));}};
    let status,result;
    const res={writeHead(s){status=s;},end(s){result=JSON.parse(s);}};
    await handler(req,res);
    return {status,...result};
  };
}

async function scenarios(request){
  assert.equal((await request('GET')).version,0);
  assert.equal((await request('PUT','/api/state',{state:{text:'first'},baseVersion:0})).version,1);
  assert.equal((await request('PUT','/api/state',{state:{text:'new'},baseVersion:1})).version,2);
  assert.equal((await request('PUT','/api/state',{state:{text:'stale'},baseVersion:1})).status,409);
  assert.equal((await request('GET')).state.text,'new');
  const writes=await Promise.all(['A','B'].map(text=>request('PUT','/api/state',{state:{text},baseVersion:2})));
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  const current=await request('GET');
  assert.equal(current.version,3);
  assert.equal(current.state.text,['A','B'][writes.findIndex(r=>r.status===200)]);
  assert.equal((await request('PUT','/api/state',{state:{text:'legacy'}})).status,400);
  assert.equal((await request('PUT','/api/state',{state:null,baseVersion:3})).status,400);
  assert.equal((await request('GET','/api/state',undefined,'wrong')).status,401);
  assert.equal((await request('PUT','/api/state',{state:{},baseVersion:3},'')).status,401);
}

test('stale snapshots and concurrent writes: handler contract',async()=>scenarios(await harness()));
test('missing token closes reads, writes and AI; health/config remain public',async()=>{
  const request=await harness('');
  for(const [method,url] of [['GET','/api/state'],['PUT','/api/state'],['POST','/api/ai']]){
    const r=await request(method,url,{state:{},baseVersion:0});
    assert.equal(r.status,503);assert.equal(r.error,'AUTH_NOT_CONFIGURED');
  }
  assert.equal((await request('GET','/api/health')).status,200);
  const config=await request('GET','/api/config');
  assert.equal(config.tokenRequired,true);assert.equal(config.authConfigured,false);
});
test('PostgreSQL: stale snapshots and real simultaneous writes',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const {Pool}=require('pg');
  const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});
  const schema='sync_test_'+process.pid+'_'+Date.now();
  let pool;
  try{
    await admin.query('CREATE SCHEMA '+schema);
    pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+schema});
    await scenarios(await harness('secret',pool));
    // Two first-time creators also cannot both succeed.
    await pool.query('DELETE FROM app_state');
    const request=await harness('secret',pool);
    const results=await Promise.all([1,2].map(n=>request('PUT','/api/state',{state:{n},baseVersion:0})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  }finally{
    if(pool) await pool.end();
    await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
  }
});

function clientHarness(replies,base=null){
  const values=new Map(),elements=new Map(),messages=[],calls=[],timers=[];
  const local={text:'local'};
  if(base)values.set('mojingNovelStudio.cloudBase',JSON.stringify(base));
  values.set('mojingNovelStudio.cloudToken','secret');
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',onclick:null});return elements.get(id);};
  const context={
    state:local,saveTimer:null,persist(){},renderSettings(){},sendAI(){},renderAll(){},
    toast(t){messages.push(t);},confirm(){return true;},escapeHtml(s){return s;},
    localStorage:{getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}},
    document:{querySelector(id){return id==='#settingsContent'?null:element(id);},querySelectorAll(){return [];}},
    setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},
    async fetch(url,options){
      calls.push({url,options});
      const response=url==='/api/config'?{databaseReady:true,authConfigured:true,tokenRequired:true}:replies.shift();
      return {ok:(response.status||200)<400,status:response.status||200,async json(){return response;}};
    }
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8'),context);
  return {context,values,messages,calls,timers,run:code=>vm.runInContext(code,context)};
}
test('client conflict preserves local data and version and pauses automatic upload',async()=>{
  const c=clientHarness([{status:409,error:'STATE_CONFLICT',version:2}],{version:1,snapshot:JSON.stringify({text:'local'})});
  await c.run('refreshCloudStatus()');
  await c.run('cloudUpload(false)');
  assert.equal(c.context.state.text,'local');
  assert.equal(c.run('cloudVersion'),1);
  assert.equal(c.run('cloudConflict'),true);
  assert.ok(c.messages.some(t=>t.includes('自动上传已暂停')));
  c.run('persist()');
  assert.equal(c.timers.length,0);
  await c.run('cloudUpload()');
  assert.equal(c.calls.filter(c=>c.options?.method==='PUT').length,1);
});
test('client without baseline never borrows remote version; download restores baseline without upload',async()=>{
  const c=clientHarness([{state:{text:'remote'},version:5},{state:{text:'remote'},version:5}]);
  await c.run('refreshCloudStatus()');
  await c.run('cloudUpload()');
  assert.equal(c.calls.filter(c=>c.options?.method==='PUT').length,0);
  assert.equal(c.context.state.text,'local');
  await c.run('cloudDownload()');
  assert.equal(c.context.state.text,'remote');
  assert.equal(c.run('cloudVersion'),5);
  assert.equal(c.run('cloudConflict'),false);
  assert.equal(c.timers.length,0);
});
