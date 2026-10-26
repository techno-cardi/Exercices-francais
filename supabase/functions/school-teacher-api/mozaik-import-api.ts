import './mozaik-import-core.js';

// The bridge reads Mozaïk using its existing local session. This API receives
// allowlisted assignment metadata only, never remote credentials or grades.
export function createMozaikImportApi(deps:any){
 const {teacherFromToken,validateKnownGroups,fail}=deps;
 const core=(globalThis as any).CardinalMozaikImportCore;
 const uuid=(value:any)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value||''));
 function dbError(error:any):never{
  const message=String(error?.message||'');
  if(/invalid_teacher|operation_teacher_mismatch/.test(message))fail('Cet aperçu appartient à une autre session enseignant.',401);
  if(/stale_preview|mozaik_link_conflict|duplicate key/.test(message))fail('Un travail ou son association Mozaïk a changé. Recharge la liste et prépare un nouvel aperçu.',409);
  fail('Impossible de confirmer cet import. Aucune modification partielle n’a été conservée. Prépare un nouvel aperçu.',409);
  throw error;
 }
 async function mozaikPreview(db:any,token:string,body:any){
  const teacher=await teacherFromToken(db,token),group=String(body.scope?.groupCode||'').trim();
  const context=deps.yearContext?await deps.yearContext(db,body.schoolYear,{write:true,external:true}):null;
  if(context&&String(body.scope?.schoolYear)!==String(context.year))fail('La liste Mozaïk appartient à une autre année scolaire.',409);
  await validateKnownGroups(db,[group],context?.year);
  let assignmentQuery=db.from('school_assignments').select('*').contains('group_codes',[group]);
  if(context)assignmentQuery=assignmentQuery.eq('school_year',context.year);
  const assignmentResponse=await assignmentQuery;
  const selectedIds=(assignmentResponse.data||[]).map((a:any)=>a.id);
  const linkResponse=selectedIds.length?await db.from('school_mozaik_links').select('*').eq('group_code',group).in('assignment_id',selectedIds):{data:[],error:null};
  const responses=[assignmentResponse,linkResponse];
  if(responses.some(r=>r.error))fail('Impossible de vérifier les travaux et leurs associations Mozaïk.',503);
  const assignments=(responses[0].data||[]).filter((a:any)=>!context||a.school_year===context.year);
  // Retain legacy links for destination conflicts but never upgrade their missing scope by guessing a year.
  const links=(responses[1].data||[]).filter((l:any)=>!context||assignments.some((a:any)=>a.id===l.assignment_id)).map((l:any)=>({assignmentId:l.assignment_id,activityId:l.activity_id,groupCode:l.group_code,schoolYear:l.school_year,schoolId:l.school_id,subjectId:l.subject_id,mozaikGroupId:l.mozaik_group_id}));
  const snapshots:any={};
  for(const s of body.selections||[]){
   if(s.mode!=='associate')continue;
   const id=String(s.assignmentId||'');
   if(!uuid(id)||!assignments.some((a:any)=>a.id===id))fail('Destination du groupe invalide.',409);
   if(!snapshots[id]){
    const {data,error}=await db.rpc('cardinal_assignment_snapshot',{p_assignment_id:id});
    if(error||!data?.assignment)fail('Impossible de vérifier le travail à associer.',409);
    snapshots[id]=data;
   }
  }
  let preview:any;
  try{preview=core.buildMetadataPreview({scope:body.scope,activities:body.activities,complete:body.complete,selections:body.selections,assignments,links,snapshots});}
  catch(error){fail(error instanceof Error?error.message:'Métadonnées Mozaïk invalides.',409);}
  const {plans,...display}=preview;
  if(context)for(const plan of plans)if(plan.newAssignment)plan.newAssignment.school_year=context.year;
  if(!plans.length)return{previewId:null,expiresAt:null,preview:display};
  const id=crypto.randomUUID(),expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const request={scope:preview.scope,selections:plans.map((p:any)=>({activityId:p.mozaikLink.activity_id,assignmentId:p.assignmentId,mode:p.assignmentId?'associate':'create'}))};
  const {error}=await db.from('school_assignment_operations').insert({id,teacher_email:teacher.email,kind:'mozaik_metadata',request,plan:{items:plans,scope:preview.scope},status:'preview',expires_at:expiresAt});
  if(error)fail('Impossible de préparer l’import des travaux. Aucune donnée n’a été modifiée.',503);
  return{previewId:id,expiresAt,preview:display};
 }
 async function mozaikConfirm(db:any,token:string,body:any){
  const teacher=await teacherFromToken(db,token);
  if(deps.yearContext)await deps.yearContext(db,body.schoolYear,{write:true,external:true});
  if(!uuid(body.previewId))fail('Identifiant d’aperçu invalide. Prépare un nouvel aperçu.');
  const {data,error}=await db.rpc('cardinal_confirm_mozaik_metadata_batch',{p_teacher:teacher.email,p_preview_id:body.previewId});
  if(error)dbError(error);
  return data;
 }
 return{mozaikPreview,mozaikConfirm};
}
