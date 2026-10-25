import {retrySlots} from './retry.mjs';
import {QUESTIONS} from './questions.mjs';
import {createGame,joinGame,applyAction,publicState,authorize} from './engine.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
class HttpError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function db(path:string,method='GET',body?:unknown,extra={}){
 const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{...headers,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!r.ok){if(r.status===409)return {conflict:true};console.error('quiz database',r.status,path.split('?')[0]);throw new HttpError('Le serveur est momentanément occupé. Réessaie.',503);}
 const text=await r.text();return text?JSON.parse(text):null;
}
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Utilise une requête POST.'},405);
 try{
  const raw=await req.text();if(raw.length>4096)throw new HttpError('Requête trop longue.',413);
  let body;try{body=JSON.parse(raw);}catch{throw new HttpError('Requête invalide.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError('Requête invalide.');
  const {action}=body;
  if(!['create','join','state','answer','advance','kick','leave','rematch','close'].includes(action))throw new HttpError('Action inconnue.');
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if(action==='create'||action==='join'){
   const rateKey=await hash(`${key}:quiz:${action}:${ip}`);
   const ok=await db('rpc/quiz_salon_rate','POST',{p_key:rateKey,p_limit:action==='create'?10:120});
   if(!ok)throw new HttpError('Trop de tentatives. Réessaie dans quelques minutes.',429);
  }
  if(action==='create'){
   await db('quiz_salon_rooms?expires_at=lt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
   await db('quiz_salon_limits?updated_at=lt.'+encodeURIComponent(new Date(Date.now()-3600000).toISOString()),'DELETE');
   const rooms=await db('quiz_salon_rooms?select=code&limit=100');
   if(rooms.length>=100)throw new HttpError('Toutes les salles sont occupées. Réessaie plus tard.',503);
   const hostToken=token(),hostHash=await hash(hostToken);
   for(let i=0;i<5;i++){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b=>chars[b%chars.length]).join('');
    const g=createGame(body.options,QUESTIONS,Date.now());g.hostHash=hostHash;
    const result=await db('quiz_salon_rooms','POST',{code,state:g});
    if(result?.conflict)continue;
    return reply({code,token:hostToken,role:'host',state:publicState(g,{role:'host',hash:hostHash})});
   }
   throw new HttpError('Création impossible. Réessaie.',503);
  }
  const code=String(body.code||'').toUpperCase().replace(/\s/g,'');
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw new HttpError('Entre le code de 6 caractères affiché à la télé.');
  const isJoin=action==='join';
  if(!isJoin&&(!/^[a-f0-9]{64}$/.test(body.token||'')||!['host','player'].includes(body.role)))throw new HttpError('Connexion invalide. Rejoins la partie de nouveau.',403);
  const secret=isJoin?token():body.token;
  const actor={role:isJoin?'player':body.role,id:isJoin?crypto.randomUUID():String(body.id||''),hash:await hash(secret)};
  // Optimistic retry: concurrent answers and joins never overwrite one another.
  for await(const attempt of retrySlots()){
   const rows=await db(`quiz_salon_rooms?code=eq.${code}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=state,revision`);
   if(!rows.length)throw new HttpError('Cette partie est introuvable ou a expiré.',404);
   const {state:g,revision}=rows[0],before=JSON.stringify(g),now=Date.now();
   if(g.phase==='closed')throw new HttpError('L’hôte a fermé cette partie.',410);
   if(isJoin)joinGame(g,body.name,actor.id,actor.hash);
   else {authorize(g,actor);applyAction(g,actor,action,body.data||{},now,QUESTIONS);}
   if(action==='leave'){
    const ok=await db('rpc/quiz_salon_store','POST',{p_code:code,p_revision:revision,p_state:g});if(!ok)continue;return reply({left:true});
   }
   const visible=publicState(g,actor,now);
   if(before!==JSON.stringify(g)){
    const ok=await db('rpc/quiz_salon_store','POST',{p_code:code,p_revision:revision,p_state:g});if(!ok)continue;
   }
   return reply({code,state:visible,...(isJoin?{token:secret,id:actor.id,role:'player'}:{})});
  }
  throw new HttpError('La partie reçoit beaucoup de réponses. Réessaie.',503);
 }catch(error){
  if(error instanceof HttpError)return reply({error:error.message},error.status);
  if(error instanceof Error&&['prénom','32 joueurs','partie est terminée','hôte','réponse','question','joueur','connexion','action','revanche','Aucune question'].some(w=>error.message.toLowerCase().includes(w.toLowerCase())))return reply({error:error.message},400);
  console.error('quiz error',error instanceof Error?error.message:'unknown');return reply({error:'Le serveur est momentanément indisponible.'},503);
 }
});
