import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

// Fonction préparée, non déployée. verify_jwt = false uniquement parce que
// la fonction vérifie elle-même la clé publiable ET le jeton serveur de session.
const ORIGIN = 'https://techno-cardi.github.io';
const encoder = new TextEncoder();
const DEFAULT_WORK_SLUG = 'dictee-eleonore-2026-10-08';
function slugFrom(body:any) { const value=String(body.workSlug||DEFAULT_WORK_SLUG); if(!/^dictee-[a-z0-9-]{1,110}$/.test(value))fail('Travail invalide.'); return value; }
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type,apikey', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
class HttpError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
function fail(message: string, status = 400): never { throw new HttpError(message, status); }
function respond(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } }); }
function env() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const pubs = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
  const secret = secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishable = pubs.default || Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !secret || !publishable) fail('Configuration serveur manquante.', 503);
  return { url, secret, publishable };
}
async function sha256(s: string) { const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(s)); return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,'0')).join(''); }
function constantEqual(a: string, b: string) { if (a.length !== b.length) return false; let n=0; for(let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n===0; }
async function getStudent(db:any,token:string) {
  if(!token || token.length<30 || token.length>500) fail('Connexion élève nécessaire.',401);
  const digest=await sha256(token);
  const {data:session,error}=await db.from('school_student_sessions').select('student_email,expires_at').eq('token_hash',digest).maybeSingle();
  if(error||!session||Date.parse(session.expires_at)<=Date.now()) fail('Session expirée. Reconnecte-toi.',401);
  const {data:student}=await db.from('school_students').select('email,name,group_code,active').eq('email',session.student_email).maybeSingle();
  if(!student?.active||!['31','32'].includes(student.group_code)) fail('Ce travail ne t’est pas attribué.',403);
  return student;
}
async function getAssignedWork(db:any,student:any,workSlug:string) {
  const {data:assignment}=await db.from('school_assignments').select('id,title,max_score,group_codes').eq('slug',workSlug).maybeSingle();
  if(!assignment||(assignment.group_codes||[]).indexOf(student.group_code)<0) fail('Travail indisponible.',404);
  const {data:feedback,error}=await db.from('fr_dictee_feedback').select('*').eq('assignment_id',assignment.id).eq('student_email',student.email).maybeSingle();
  if(error||!feedback) fail('Copie individuelle non disponible.',404);
  return {assignment,feedback};
}
async function update(db:any,assignmentId:string,email:string,patch:Record<string,unknown>,attemptNumber:number) {
  const {data,error}=await db.from('fr_dictee_feedback').update({...patch,updated_at:new Date().toISOString()}).eq('assignment_id',assignmentId).eq('student_email',email).eq('attempt_number',attemptNumber).select('attempt_number').maybeSingle();
  if(error) fail('Impossible d’enregistrer la progression.',500);
  if(!data)fail('Le parcours a été recommencé dans un autre onglet. Actualise la page.',409);
}
async function teacherAllowed(db:any,token:string) {
  if(!token||token.length<30||token.length>500)fail('Connexion enseignant nécessaire.',401);
  const digest=await sha256(token);
  const {data:session,error:sessionError}=await db.from('school_teacher_sessions')
    .select('teacher_email,expires_at').eq('token_hash',digest).maybeSingle();
  if(sessionError||!session||Date.parse(session.expires_at)<=Date.now())fail('Session enseignant expirée.',401);
  const {data:teacher,error:teacherError}=await db.from('school_teachers')
    .select('email,active').eq('email',session.teacher_email).maybeSingle();
  if(teacherError||!teacher?.active)fail('Compte enseignant non autorisé.',403);
  return teacher;
}
async function teacherCatalog(db:any,body:any) {
  await teacherAllowed(db,String(body.token||''));
  const {data,error}=await db.from('school_assignments')
    .select('slug,title,group_codes,max_score,activity_date,activity_type')
    .not('slug','is',null).order('activity_date',{ascending:false});
  if(error)fail('Impossible de charger les travaux.',500);
  const dictations=(data||[]).filter((item:any)=>String(item.slug||'').startsWith('dictee-'));
  return {works:dictations.map((w:any)=>({slug:w.slug,title:w.title,groups:w.group_codes||[],maxScore:w.max_score,date:w.activity_date||null}))};
}
function choicePosition(email:string,key:string) {
  const input=email+'|'+key; let hash=0;
  for(let i=0;i<input.length;i++)hash=((hash*33)^input.charCodeAt(i))>>>0;
  return hash%3;
}
async function teacherStatus(db:any, body:any) {
  await teacherAllowed(db,String(body.token||''));
  const {data:assignment}=await db.from('school_assignments').select('id,title,max_score,group_codes').eq('slug',slugFrom(body)).maybeSingle();
  if(!assignment) fail('Travail indisponible.',404);
  const selected=String(body.group||'all');
  if(selected!=='all'&&!(assignment.group_codes||[]).includes(selected)) fail('Groupe inconnu.');
  let q=db.from('school_students').select('email,name,group_code').eq('active',true).in('group_code',selected==='all'?assignment.group_codes:[selected]);
  const {data:students,error:e1}=await q;
  const {data:details,error:e2}=await db.from('fr_dictee_feedback').select('student_email,errors,errors_verified,released,started_at,copy_opened_at,bilan_seen_at,understood_keys,completed_at,attempt_number,attempt_history').eq('assignment_id',assignment.id);
  const {data:results,error:e3}=await db.from('school_results').select('student_email,grade').eq('assignment_id',assignment.id);
  if(e1||e2||e3) fail('Impossible de charger le suivi.',500);
  const dmap=new Map((details||[]).map((x:any)=>[x.student_email,x]));
  const rmap=new Map((results||[]).map((x:any)=>[x.student_email,x]));
  const rows=(students||[]).map((s:any)=>{
    const d=dmap.get(s.email);const r=rmap.get(s.email);
    const total=d?.errors_verified&&Array.isArray(d.errors)?d.errors.length:null;
    const count=total===null?null:(d.understood_keys||[]).filter((key:string)=>d.errors.some((e:any)=>e.key===key)).length;
    return {name:s.name,group:s.group_code,email:s.email,grade:r?.grade??null,ready:!!d?.errors_verified,released:!!d?.released,startedAt:d?.started_at||null,copyOpenedAt:d?.copy_opened_at||null,bilanSeenAt:d?.bilan_seen_at||null,understoodCount:count,totalErrors:total,completedAt:d?.completed_at||null,attemptNumber:d?.attempt_number||1,attemptCount:d?.started_at?d.attempt_number:0,attemptHistory:d?.attempt_history||[]};
  });
  return {assignment:{id:assignment.id,title:assignment.title,maxScore:assignment.max_score},rows};
}
async function teacherPreview(db:any,body:any) {
  await teacherAllowed(db,String(body.token||''));
  const email=String(body.studentEmail||'').trim().toLowerCase();
  if(!/^[^\s@]+@educ\.cscapitale\.qc\.ca$/.test(email))fail('Élève invalide.',400);
  const {data:student}=await db.from('school_students').select('email,name,group_code,active').eq('email',email).maybeSingle();
  if(!student?.active||!['31','32'].includes(student.group_code))fail('Élève introuvable.',404);
  const {assignment,feedback:f}=await getAssignedWork(db,student,slugFrom(body));
  const {data:result}=await db.from('school_results').select('grade').eq('assignment_id',assignment.id).eq('student_email',email).maybeSingle();
  return {ok:true,attemptNumber:f.attempt_number||1,preview:true,ready:!!f.errors_verified,unreleased:!f.released,first:student.name.split(' ')[0],studentName:student.name,assignment:assignment.title,group:student.group_code,grade:result?.grade??null,maxScore:assignment.max_score,copyUrl:f.copy_url,errors:f.errors_verified?f.errors:[],progress:{copyOpened:!!f.copy_opened_at,bilanSeen:!!f.bilan_seen_at,understoodKeys:f.understood_keys||[],strategyKeys:f.strategy_passed_keys||[],completedAt:f.completed_at||null}};
}
Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    if(req.method!=='POST') fail('Méthode non permise.',405);
    if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN) fail('Origine non autorisée.',403);
    const cfg=env();if(req.headers.get('apikey')!==cfg.publishable) fail('Accès refusé.',401);
    const db=createClient(cfg.url,cfg.secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>null);if(!body||typeof body!=='object') fail('Requête invalide.');
    const action=String(body.action||'');
    if(action==='teacherStatus') return respond({ok:true,...await teacherStatus(db,body)});
    if(action==='teacherCatalog') return respond({ok:true,...await teacherCatalog(db,body)});
    if(action==='teacherPreview') return respond(await teacherPreview(db,body));
    if(!['load','copyOpened','bilanSeen','strategy','understood','finish','restart'].includes(action))fail('Action inconnue.');
    const student=await getStudent(db,String(body.token||''));
    const {assignment,feedback:f}=await getAssignedWork(db,student,slugFrom(body));
    if(!f.released) {
      // Les corrections peuvent être suspendues sans priver les élèves de leurs scans originaux.
      if(action!=='load') fail('Corrections interactives temporairement suspendues.',409);
      return respond({ok:true,ready:false,unreleased:true,underReview:true,copyUrl:f.copy_url,first:student.name.split(' ')[0],group:student.group_code,progress:{completedAt:f.completed_at||null,copyOpened:!!f.copy_opened_at}});
    }
    if(action!=='load' && Number(body.attemptNumber||1)!==f.attempt_number)fail('Le parcours a été recommencé. Actualise la page avant de continuer.',409);
    if(action==='restart'){
      const {data,error}=await db.rpc('fr_dictee_restart',{p_assignment_id:assignment.id,p_student_email:student.email,p_expected_attempt:Number(body.attemptNumber||1)});
      if(error)fail(error.code==='40001'?'Le parcours a déjà été recommencé. Actualise la page.':'Impossible de recommencer le parcours.',409);
      return respond({ok:true,attemptNumber:data});
    }
    if(action==='load'){
      if(!f.started_at) await update(db,assignment.id,student.email,{started_at:new Date().toISOString()},f.attempt_number);
      const {data:result}=await db.from('school_results').select('grade').eq('assignment_id',assignment.id).eq('student_email',student.email).maybeSingle();
      const errors=f.errors_verified?f.errors:[];
      return respond({ok:true,attemptNumber:f.attempt_number||1,ready:!!f.errors_verified,first:student.name.split(' ')[0],assignment:assignment.title,group:student.group_code,grade:result?.grade??null,maxScore:assignment.max_score,copyUrl:f.copy_url,errors,progress:{copyOpened:!!f.copy_opened_at,bilanSeen:!!f.bilan_seen_at,understoodKeys:f.understood_keys||[],strategyKeys:f.strategy_passed_keys||[],completedAt:f.completed_at||null}});
    }
    // Conserver l'heure de la première validation tout en permettant de revoir de nouvelles corrections.
    if(f.completed_at && action==='finish')return respond({ok:true,completedAt:f.completed_at,alreadyCompleted:true,progress:{copyOpened:true,bilanSeen:true,understoodKeys:f.understood_keys}});
    if(action==='copyOpened'){await update(db,assignment.id,student.email,{copy_opened_at:f.copy_opened_at||new Date().toISOString()},f.attempt_number);return respond({ok:true});}
    if(action==='bilanSeen'){await update(db,assignment.id,student.email,{bilan_seen_at:f.bilan_seen_at||new Date().toISOString()},f.attempt_number);return respond({ok:true});}
    if(action==='strategy') {
      if(!f.errors_verified)fail('Les erreurs personnelles ne sont pas encore vérifiées.',409);
      const key=String(body.key||'');
      if(!(f.errors||[]).some((e:any)=>e.key===key))fail('Erreur non attribuée.',400);
      const choice=Number(body.choice);
      if(!Number.isInteger(choice)||choice<0||choice>2)fail('Choix invalide.',400);
      const passed=choicePosition(student.email,key)===choice;
      if(passed){
        const keys=new Set<string>(f.strategy_passed_keys||[]);keys.add(key);
        await update(db,assignment.id,student.email,{strategy_passed_keys:[...keys]},f.attempt_number);
      }
      return respond({ok:true,correct:passed});
    }
    if(action==='understood'){
      if(!f.errors_verified)fail('Les erreurs personnelles ne sont pas encore vérifiées.',409);
      const key=String(body.key||'');const allowed=(f.errors||[]).some((e:any)=>e.key===key);
      if(!allowed)fail('Erreur non attribuée.',400);
      if(body.understood===true && !(f.strategy_passed_keys||[]).includes(key))fail('Choisis d’abord une stratégie adaptée.',409);
      const set=new Set<string>(f.understood_keys||[]);
      if(body.understood===true)set.add(key);else set.delete(key);
      await update(db,assignment.id,student.email,{understood_keys:[...set]},f.attempt_number);return respond({ok:true,understoodKeys:[...set]});
    }
    if(!f.errors_verified||!f.copy_opened_at||!f.bilan_seen_at)fail('Termine les étapes précédentes.',409);
    if((f.errors||[]).some((e:any)=>!(f.understood_keys||[]).includes(e.key)||!(f.strategy_passed_keys||[]).includes(e.key)))fail('Il reste des erreurs à vérifier.',409);
    if(f.locked_until&&Date.parse(f.locked_until)>Date.now()) fail('Après cinq codes incorrects, la validation est bloquée jusqu’à '+new Intl.DateTimeFormat('fr-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'America/Toronto'}).format(new Date(f.locked_until))+'. Vérifie le code de la page 1 de ton PDF avant de réessayer.',429);
    const code=String(body.secret||'').normalize('NFC').toLowerCase().replace(/\s+/g,'').replace(/[\u2010-\u2015\u2212]/g,'-');
    if(!/^[a-z]{4}-[a-z]{4}$/.test(code)||!constantEqual(await sha256(code),f.secret_hash)){
      const failed=(f.locked_until&&Date.parse(f.locked_until)<=Date.now()?0:Number(f.failed_attempts||0))+1;
      await update(db,assignment.id,student.email,{failed_attempts:failed,locked_until:failed>=5?new Date(Date.now()+15*60*1000).toISOString():null},f.attempt_number);
      if(failed>=5)fail('Mot secret incorrect. Après cinq essais, la validation est bloquée pendant 15 minutes. Vérifie le code de la page 1 de ton PDF.',429);
      fail('Mot secret incorrect. Vérifie le code de la page 1 de ton PDF. Il reste '+(5-failed)+' essai'+(5-failed>1?'s':'')+' avant le blocage temporaire.',403);
    }
    const stamp=new Date().toISOString();
    await update(db,assignment.id,student.email,{completed_at:stamp,failed_attempts:0,locked_until:null},f.attempt_number);
    return respond({ok:true,completedAt:stamp});
  }catch(e){const err=e instanceof HttpError?e:new HttpError('Une erreur est survenue.',500);return respond({ok:false,message:err.message},err.status);}
});
