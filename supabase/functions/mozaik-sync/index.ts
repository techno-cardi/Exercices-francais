import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {yearContext,annualEnrollments} from '../_shared/school-years.ts';

const ORIGIN="https://techno-cardi.github.io";
const enc=new TextEncoder();
function cors(o:string|null){return{"Access-Control-Allow-Origin":[ORIGIN,"https://mozaikportail.ca"].includes(o||"")?o!:ORIGIN,"Access-Control-Allow-Headers":"content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}}
function reply(body:unknown,status=200,o:string|null=null){return new Response(JSON.stringify(body),{status,headers:{...cors(o),"Content-Type":"application/json; charset=utf-8"}})}
function fail(message:string,status=400):never{const e=new Error(message) as Error&{status?:number};e.status=status;throw e}
function db(){const url=Deno.env.get("SUPABASE_URL")||"";const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");const key=keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!url||!key)fail("Service temporairement indisponible.",503);return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function requireKey(req:Request){const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");const expected=keys.default||Deno.env.get("SUPABASE_ANON_KEY")||"";if(!expected||req.headers.get("apikey")!==expected)fail("Accès refusé.",401)}
async function sha(v:string){const d=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v)));return[...d].map(b=>b.toString(16).padStart(2,"0")).join("")}
function randomToken(n=32){const b=crypto.getRandomValues(new Uint8Array(n));let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function randomCode(){const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const b=crypto.getRandomValues(new Uint8Array(10));return[...b].map(x=>a[x%a.length]).join("")}
function cleanGroupCode(v:unknown){const s=String(v||"").trim().slice(0,40);if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/.test(s))fail("Groupe invalide.");return s}
async function teacherFromToken(client:any,token:string){if(!token)fail("Session enseignant expirée.",401);const h=await sha(token);const{data:s}=await client.from("school_teacher_sessions").select("teacher_email,expires_at").eq("token_hash",h).maybeSingle();if(!s||new Date(s.expires_at).getTime()<=Date.now())fail("Session enseignant expirée.",401);const{data:t}=await client.from("school_teachers").select("email,name,active").eq("email",s.teacher_email).maybeSingle();if(!t?.active)fail("Compte enseignant inactif.",403);return t}
async function ensureKnownGroup(client:any,groupCode:string){const{count,error}=await client.from("school_students").select("email",{count:"exact",head:true}).eq("active",true).eq("group_code",groupCode);if(error)fail("Impossible de valider le groupe.",500);if(!count)fail("Ce groupe n’existe pas dans Gestion des notes.",400)}
async function status(client:any,body:any){const teacher=await teacherFromToken(client,String(body.teacherToken||""));const id=String(body.assignmentId||"");const{data,error}=await client.from("school_mozaik_links").select("group_code,activity_id,competence_code,sync_status,last_synced_at,last_result_count,last_error").eq("assignment_id",id).order("group_code");if(error)fail("Impossible de charger l’état Mozaïk.",500);const{data:jobs,error:jobError}=await client.from("school_mozaik_sync_jobs").select("id,group_code,status,checkpoint,created_at,reconcile_stale").eq("assignment_id",id).eq("teacher_email",teacher.email).eq("status","claimed");if(jobError)fail("Impossible de charger les journaux Mozaïk.",500);return{links:data||[],pendingJobs:(jobs||[]).map((j:any)=>({jobId:j.id,groupCode:j.group_code,phase:j.checkpoint?.phase||"claimed",reconcilingStale:j.reconcile_stale===true,createdAt:j.created_at}))}}
function competenceForSync(assignment:any,link:any){
 const competenceKind=String(assignment.mozaik_competence_kind||"").trim();
 const competenceCode=String(assignment.mozaik_competence_code||(!competenceKind?link?.competence_code:"")||"").trim();
 return{competenceKind,competenceCode};
}
function mozaikScope(groupCode:string,g:any){
 const schoolId=String(g.establishment_id||'');
 const year=(id:unknown)=>{const raw=String(id||'');return schoolId&&raw.startsWith(schoolId)?raw.slice(schoolId.length).match(/^(20\d{2})/)?.[1]||null:null;};
 const schoolYear=year(g.group_matter_id);
 if(!schoolYear||year(g.group_course_id)!==schoolYear)fail("L’année scolaire des identifiants Mozaïk doit être confirmée.",409);
 return{groupCode,schoolYear,schoolId,subjectId:String(g.subject_code),mozaikGroupId:String(g.group_matter_id)};
}
function validateDestinationSwitch(choice:any,link:any,scope:any,owners:any[],assignmentId:string){
 if(!choice||typeof choice!=='object'||Array.isArray(choice)||!link?.activity_id||String(choice.previousActivityId||'')!==String(link.activity_id))fail('L’association Mozaïk a changé. Recharge le choix de destination.',409);
 const target=choice.activityId;
 if(target!==null&&(typeof target!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(target)||target===String(link.activity_id)))fail('Destination Mozaïk invalide.',409);
 if(target!==null&&owners.some((other:any)=>{
  if(String(other.assignment_id)===assignmentId||String(other.activity_id)!==target)return false;
  const fields=[['school_year','schoolYear'],['school_id','schoolId'],['subject_id','subjectId'],['mozaik_group_id','mozaikGroupId']];
  return String(other.group_code)===scope.groupCode&&fields.some(([field])=>other[field]==null)||fields.every(([field,key])=>String(other[field]??'')===scope[key]);
 }))fail('Cette activité possède déjà une association ou un ancien lien à vérifier.',409);
 return {previousActivityId:String(link.activity_id),activityId:target};
}
async function prepare(client:any,body:any){
  const teacher=await teacherFromToken(client,String(body.teacherToken||""));
  const assignmentId=String(body.assignmentId||"");const groupCode=cleanGroupCode(body.groupCode);
  await ensureKnownGroup(client,groupCode);
  const[{data:a},{data:g},{data:link},{data:students},{data:results}]=await Promise.all([
    client.from("school_assignments").select("*").eq("id",assignmentId).maybeSingle(),
    client.from("school_mozaik_groups").select("group_code,establishment_id,group_course_id,group_matter_id,subject_code").eq("group_code",groupCode).maybeSingle(),
    client.from("school_mozaik_links").select("activity_id,competence_code,sync_status,school_year,school_id,subject_id,mozaik_group_id").eq("assignment_id",assignmentId).eq("group_code",groupCode).maybeSingle(),
    client.from("school_students").select("email,name,group_code").eq("active",true).eq("group_code",groupCode),
    client.from("school_results").select("student_email,grade").eq("assignment_id",assignmentId).not("grade","is",null)
  ]);
  if(!a||a.group_codes?.length!==1||!(a.group_codes||[]).includes(groupCode))fail("Ce travail n’est pas associé à ce groupe.");
  if(!g)fail("Configuration Mozaïk du groupe introuvable. Lance d’abord la détection automatique.",409);
  const scope=mozaikScope(groupCode,g);
  if(link&&([['school_year','schoolYear'],['school_id','schoolId'],['subject_id','subjectId'],['mozaik_group_id','mozaikGroupId']] as const).some(([field,key])=>link[field]!=null&&String(link[field])!==scope[key]))fail("Le lien Mozaïk appartient à une autre année, école ou matière.",409);
  const year=await yearContext(client,body.schoolYear,{assignment:a,write:true,external:true});
  if(String(scope.schoolYear)!==String(year.year))fail('Les identifiants Mozaïk appartiennent à une autre année scolaire.',409);
  let switched:any=null;
  if(body.destination!==undefined){
   const target=body.destination?.activityId;
   const response=target==null?{data:[],error:null}:await client.from('school_mozaik_links').select('assignment_id,group_code,activity_id,school_year,school_id,subject_id,mozaik_group_id').eq('activity_id',String(target));
   if(response.error)fail('Impossible de vérifier la destination Mozaïk.',503);
   switched=validateDestinationSwitch(body.destination,link,scope,response.data||[],assignmentId);
  }
  const enrolled=(await annualEnrollments(client,year.year,groupCode)).filter((s:any)=>s.active);
  const map=new Map(enrolled.map((s:any)=>[s.email,s]));
  if((results||[]).some((r:any)=>!map.has(r.student_email)))fail('Des notes historiques concernent des élèves qui ne sont plus inscrits dans ce groupe. Elles restent conservées dans Gestion; vérifie la liste avant un envoi Mozaïk.',409);
  const rows=(results||[]).filter((r:any)=>map.has(r.student_email)).map((r:any)=>({email:r.student_email,name:map.get(r.student_email).name,grade:r.grade===null||String(r.grade).trim()===""?NaN:Number(r.grade)}));
  if(rows.some((r:any)=>!Number.isFinite(r.grade)))fail("Une note est illisible. Aucune valeur ne sera remplacée par zéro.");
  if(!rows.length)fail("Aucune note à synchroniser pour ce groupe.");
  const s={term:a.term,period:a.mozaik_period,activityDate:a.activity_date,weight:a.weight,competenceKind:a.mozaik_competence_kind,competenceCode:a.mozaik_competence_code,homework:a.mozaik_homework,showInSchedule:a.mozaik_show_in_schedule,reportCardEnabled:a.report_card_enabled,resultsVisible:a.mozaik_results_visible};const term=Number(s.term);const period=Number(s.period);const maxScore=Number(a.max_score);
  const weightRaw=s.weight===""||s.weight===null||s.weight===undefined?a.weight:s.weight;const weight=weightRaw===null||weightRaw===undefined||weightRaw===""?null:Number(weightRaw);
  if(a.import_state==="metadata_only"||a.max_score===null||!Number.isFinite(maxScore)||maxScore<=0)fail("Complète le maximum du travail avant synchronisation.");
  if(![1,2,3].includes(term))fail("Étape invalide.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s.activityDate||"")))fail("Date invalide.");
  if(!Number.isFinite(period)||period<1||period>20)fail("Période invalide.");
  if((weight===null&&s.reportCardEnabled===true&&a.source_metadata?.mozaik?.weight!==null)||weight!==null&&(!Number.isFinite(weight)||weight<0||weight>100))fail("Entre une pondération entre 0 et 100.");
  const {competenceKind,competenceCode}=competenceForSync(a,switched?null:link);
  if(competenceKind&&!['lecture','ecriture','oral'].includes(competenceKind))fail("Compétence invalide.");
  const payload:any={sourceRevision:a.revision,protocolVersion:2,scope,group:{code:groupCode,establishmentId:g.establishment_id,groupCourseId:g.group_course_id,groupMatterId:g.group_matter_id,subjectCode:g.subject_code},assignment:{id:a.id,title:a.title,competencies:a.competencies||[],term,activityDate:String(s.activityDate),period,homework:!!s.homework,showInSchedule:s.showInSchedule!==false,reportCardEnabled:!!s.reportCardEnabled,weight,maxScore,resultsVisible:!!s.resultsVisible,sourceMetadata:a.source_metadata?.mozaik||null,metadataOverrides:Array.isArray(a.source_metadata?.mozaikOverrides)?a.source_metadata.mozaikOverrides.filter((key:string)=>["reportCardEnabled","weight","resultsVisible","showInSchedule","homework"].includes(key)):[],competenceKind,competenceCode},results:rows,link:link?{activityId:link.activity_id||"",competenceCode:link.competence_code||""}:null};
  if(switched){payload.previousLink={activityId:switched.previousActivityId};payload.link=switched.activityId?{activityId:switched.activityId,competenceCode:''}:null;}
  const {data:active,error:activeError}=await client.from("school_mozaik_sync_jobs").select("id").eq("assignment_id",assignmentId).eq("group_code",groupCode).eq("status","claimed").maybeSingle();
  if(activeError)fail("Impossible de vérifier les lots en cours.",500);
  if(active)fail("Un envoi est déjà pris en charge. Reprends son journal avant une nouvelle préparation.",409);
  await client.from("school_mozaik_sync_jobs").update({status:"expired",completed_at:new Date().toISOString(),result:{success:false,message:"Remplacé par une préparation plus récente."}}).eq("assignment_id",assignmentId).eq("group_code",groupCode).eq("teacher_email",teacher.email).eq("status","ready");
  const code=randomCode();const codeHash=await sha(code);const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const{error}=await client.from("school_mozaik_sync_jobs").insert({code_hash:codeHash,assignment_id:assignmentId,group_code:groupCode,payload,status:"ready",expires_at:expiresAt,teacher_email:teacher.email});
  if(error)fail("Impossible de préparer la synchronisation.",500);
  return{code,expiresAt,resultCount:rows.length,mode:payload.link?.activityId?"update":"create",...(switched?{destinationAccepted:switched}:{})}
}
async function claimJob(client:any,j:any){if(!j||j.status!=="ready"||new Date(j.expires_at).getTime()<=Date.now())fail("Aucune synchronisation prête ou le lot a expiré.",401);const claimToken=randomToken();const claimHash=await sha(claimToken);const{data,error}=await client.from("school_mozaik_sync_jobs").update({status:"claimed",claim_hash:claimHash,claimed_at:new Date().toISOString()}).eq("id",j.id).eq("status","ready").select("id").maybeSingle();if(error||!data)fail("Impossible de prendre en charge ce lot.",409);return{jobId:j.id,claimToken,payload:{...j.payload,checkpoint:j.checkpoint||null}}}
async function claim(client:any,body:any){const code=String(body.code||"").trim().toUpperCase();if(!code)fail("Code manquant.");const h=await sha(code);const{data:j}=await client.from("school_mozaik_sync_jobs").select("id,payload,status,expires_at,checkpoint").eq("code_hash",h).maybeSingle();return await claimJob(client,j)}
async function claimLatest(client:any,body:any){const teacher=await teacherFromToken(client,String(body.teacherToken||""));const{data:j}=await client.from("school_mozaik_sync_jobs").select("id,payload,status,expires_at,checkpoint").eq("teacher_email",teacher.email).eq("status","ready").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!j)fail("Aucune synchronisation prête. Prépare-la d’abord dans la console enseignant.",404);return await claimJob(client,j)}
async function resume(client:any,body:any){
 const teacher=await teacherFromToken(client,String(body.teacherToken||""));
 const token=randomToken();
 const {data,error}=await client.rpc("cardinal_resume_mozaik_job",{p_teacher:teacher.email,p_job_id:String(body.jobId||""),p_claim_hash:await sha(token)});
 if(error)fail("Ce journal ne peut pas être repris : lot actif, périmé ou données source modifiées.",409);
 return {jobId:data.jobId,claimToken:token,payload:data.payload};
}
async function cancelUnwritten(client:any,body:any){
 const teacher=await teacherFromToken(client,String(body.teacherToken||""));
 const {data,error}=await client.rpc('cardinal_cancel_unwritten_mozaik_job',{p_teacher:teacher.email,p_job_id:String(body.jobId||'')});
 if(error)fail('Ce journal ne peut pas être annulé. Vérifie son état avant de continuer.',409);
 return data;
}
async function reconcileStale(client:any,body:any){
 const teacher=await teacherFromToken(client,String(body.teacherToken||""));
 const token=randomToken();
 const {data,error}=await client.rpc("cardinal_reconcile_mozaik_job",{p_teacher:teacher.email,p_job_id:String(body.jobId||""),p_claim_hash:await sha(token)});
 if(error)fail("Ce journal exige une vérification manuelle : création incertaine, groupe, élèves ou lien modifiés.",409);
 return {...data,...(data.mode==="reconcile"?{claimToken:token}:{})};
}
async function checkpoint(client:any,body:any){
 const value=body.checkpoint;
 if(!value||typeof value!=="object"||JSON.stringify(value).length>2000000)fail("Journal invalide.");
 const {data,error}=await client.rpc("cardinal_checkpoint_mozaik_job",{p_job_id:String(body.jobId||""),p_claim_hash:await sha(String(body.claimToken||"")),p_checkpoint:value});
 if(error)fail("Le travail ou les données Mozaïk ont changé; reprends la préparation.",409);
 return {checkpoint:data};
}
async function complete(client:any,body:any){
 const success=body.success===true;
 if(success&&(body.verified!==true||!Number.isSafeInteger(body.verifiedCount)||body.verifiedCount<1||body.verifiedCount!==body.syncedCount))fail("La vérification complète Mozaïk est obligatoire.",409);
 const {data,error}=await client.rpc("cardinal_finish_mozaik_job",{p_job_id:String(body.jobId||""),p_claim_hash:await sha(String(body.claimToken||"")),p_result:{success,activityId:String(body.activityId||""),competenceCode:String(body.competenceCode||""),syncedCount:body.syncedCount,verified:body.verified===true,verifiedCount:body.verifiedCount,message:String(body.message||"").slice(0,1000)}});
 if(error)fail("La synchronisation ne peut pas être confirmée : lot périmé, révision modifiée ou vérification incomplète.",409);
 return data;
}
Deno.serve(async(req:Request)=>{const o=req.headers.get("origin");if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(o)});try{if(req.method!=="POST")fail("Méthode non permise.",405);if(o&&![ORIGIN,"https://mozaikportail.ca"].includes(o))fail("Origine non autorisée.",403);requireKey(req);let body:any={};try{body=await req.json()}catch{fail("Requête invalide.");}if(o==="https://mozaikportail.ca"&&body.action!=="checkpoint")fail("Action non autorisée depuis Mozaïk.",403);const client=db();let out:any;switch(String(body.action||"")){case"status":out=await status(client,body);break;case"prepare":out=await prepare(client,body);break;case"claim":out=await claim(client,body);break;case"claimLatest":out=await claimLatest(client,body);break;case"cancelUnwritten":out=await cancelUnwritten(client,body);break;case"reconcileStale":out=await reconcileStale(client,body);break;case"resume":out=await resume(client,body);break;case"checkpoint":out=await checkpoint(client,body);break;case"complete":out=await complete(client,body);break;default:fail("Demande inconnue.");}return reply({ok:true,...out},200,o)}catch(error){const e=error as Error&{status?:number};console.error(e.message);return reply({ok:false,message:e.message||"Une erreur est survenue."},e.status||500,o)}});
