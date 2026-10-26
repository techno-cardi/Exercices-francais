import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
test('legacy results endpoint rejects teacher writes before touching records',async()=>{
 let handler,writes=0;
 const source=stripTypeScriptTypes(readFileSync(new URL('../../supabase/functions/school-results/index.ts',import.meta.url),'utf8').replace(/^import .*$/gm,''),{mode:'transform'});
 const ctx={console:{error(){}},Response,Request,TextEncoder,crypto:globalThis.crypto,createClient:()=>({from(){writes++;throw Error('Legacy endpoint must never write')}}),Deno:{env:{get:k=>({SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_ANON_KEY:'public'}[k]||'')},serve:fn=>{handler=fn}}};
 vm.runInNewContext(source,ctx);
 for(const action of ['saveAssignment','saveResult']){
  const response=await handler(new Request('https://local.invalid',{method:'POST',headers:{apikey:'public','content-type':'application/json'},body:JSON.stringify({action,token:'old'})}));
  assert.equal(response.status,409);assert.match((await response.json()).message,/Actualise Gestion/);
 }
 assert.equal(writes,0);
});
