import './import-core.js';

export function createImportApi(deps:any) {
  const {teacherFromToken,cleanAssignment,validateKnownGroups,normalizeEmail,fail}=deps;
  const core=(globalThis as any).CardinalGestionImportCore;
  const uuid=(v:any)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(v||''));
  const cleanPatch=(input:any)=>Object.fromEntries(Object.entries(input).filter(([key])=>!['id','group_codes','updated_at'].includes(key)));
  function databaseError(error:any):never {
    const message=String(error?.message||'');
    const map:any={stale_preview:'Les notes ou les paramètres ont changé. Prépare un nouvel aperçu.',preview_expired:'Cet aperçu a expiré. Prépare-le à nouveau.',operation_not_found:'Cet aperçu est introuvable. Prépare-le à nouveau.',operation_payload_conflict:'Cette opération a déjà été utilisée avec un autre contenu. Prépare un nouvel aperçu.',assignment_requires_single_group:'Ce travail est encore partagé entre plusieurs groupes. Sépare ses groupes avant de le modifier.',invalid_result_student:'Un élève ne correspond plus au groupe de destination. Prépare un nouvel aperçu.',invalid_remaining_result_grade:'Certaines anciennes notes ne correspondent pas au nouveau maximum. Vérifie la remise à l’échelle.',invalid_teacher:'La session enseignant doit être renouvelée.',operation_teacher_mismatch:'Cet aperçu appartient à une autre session enseignant.'};
    const key=Object.keys(map).find(k=>message.includes(k));
    fail(key?map[key]:'Impossible d’enregistrer cette opération. Aucune modification partielle n’a été conservée.',key&&['invalid_teacher','operation_teacher_mismatch'].includes(key)?401:409);
  }
  async function rpc(db:any,name:string,args:any){const {data,error}=await db.rpc(name,args);if(error)databaseError(error);return data;}
  async function snapshot(db:any,id:string){const data=await rpc(db,'cardinal_assignment_snapshot',{p_assignment_id:id});if(!data?.assignment)fail('Travail introuvable.',404);return data;}
  function singleGroup(a:any,group?:string){if(!Array.isArray(a?.group_codes)||a.group_codes.length!==1||(group&&a.group_codes[0]!==group))fail('Ce travail est encore partagé ou appartient à un autre groupe. Sépare ses groupes avant de modifier ses notes.',409);return a.group_codes[0];}
  async function rosterFor(db:any,group:string,results:any[]=[]){
    // Include historic students referenced by results, while the core separately
    // checks eligibility for new incoming scores.
    const {data,error}=await db.from('school_students').select('email,name,first_name,last_name,group_code,active');
    if(error)fail('Impossible de vérifier les élèves de ce groupe.',503);
    const historical=new Set(results.map((r:any)=>r.student_email));
    return(data||[]).filter((s:any)=>s.group_code===group||historical.has(s.email));
  }
  async function storePreview(db:any,teacher:string,kind:string,request:any,plan:any,preview:any){
    const id=crypto.randomUUID(),expiresAt=new Date(Date.now()+15*60*1000).toISOString();
    const {error}=await db.from('school_assignment_operations').insert({id,teacher_email:teacher,kind,request,plan,status:'preview',expires_at:expiresAt});
    if(error)fail('Impossible de préparer cet aperçu. Aucune note n’a été modifiée.',503);
    return{previewId:id,expiresAt,preview};
  }
  async function formativePreview(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token),f=body.formative||{},group=String(f.groupCode||'').trim();
    await validateKnownGroups(db,[group]);
    const destination=String(body.destinationAssignmentId||'').trim();
    const before=destination?await snapshot(db,destination):null;
    if(before)singleGroup(before.assignment,group);
    const roster=await rosterFor(db,group,before?.results||[]);
    const preview=core.buildPreview({formative:f,selectedQuestionIds:body.selectedQuestionIds,assignment:before?.assignment||null,results:before?.results||[],roster,selectedEmails:body.selectedEmails,scaleMode:body.scaleMode});
    const patch:any={max_score:preview.targetMaxScore,import_state:'ready',formative_scale_mode:preview.scaleMode};
    const existing=before?.assignment;
    const sourceLink={...preview.sourceLink,formative_last_synced_at:new Date().toISOString()};
    const warnings:string[]=[];
    if(existing?.formative_id&&(existing.formative_id!==sourceLink.formative_id||existing.formative_assignment_id!==sourceLink.formative_assignment_id||existing.formative_section_id!==sourceLink.formative_section_id))warnings.push('Ce travail est lié à un autre questionnaire Formative. La confirmation remplacera cette association; les notes concernées sont détaillées ci-dessous.');
    preview.warnings=warnings;
    if(before&&Number(before.assignment.max_score)!==preview.targetMaxScore&&preview.rows.some((r:any)=>r.action==='blocked'&&r.beforeGrade!==null))fail('Une ancienne note ne peut pas être remise à l’échelle. Vérifie les lignes concernées avant de changer le maximum.',409);
    let newAssignment=null;
    if(!before){
      const cleaned=cleanAssignment({...body.settings,title:body.settings?.title||f.title||'Formative',groups:[group],maxScore:preview.targetMaxScore,importState:'ready'});
      newAssignment=cleanPatch(cleaned);
    }
    const plan={assignmentId:destination||null,beforeSnapshot:before,assignmentPatch:patch,newAssignment,groupCode:group,writes:preview.writes,sourceLink,summary:{counts:preview.counts,questionCount:preview.questionMeta.length,skippedIncomplete:preview.rows.filter((r:any)=>r.reason.includes('incomplet')).length,skippedUnknown:preview.unmatched.length}};
    const request={formativeId:sourceLink.formative_id,formativeAssignmentId:sourceLink.formative_assignment_id,formativeSectionId:sourceLink.formative_section_id,groupCode:group,destinationAssignmentId:destination,selectedQuestionIds:body.selectedQuestionIds,scaleMode:preview.scaleMode};
    // The stored plan contains the authoritative writes; clients receive only
    // display rows and cannot submit a rewritten grade list at confirmation.
    const display={...preview};delete display.writes;
    return storePreview(db,teacher.email,'formative_import',request,plan,display);
  }
  async function formativeConfirm(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token);
    if(!uuid(body.previewId))fail('Identifiant d’aperçu invalide. Prépare un nouvel aperçu.');
    return rpc(db,'cardinal_confirm_assignment_operation',{p_teacher:teacher.email,p_preview_id:body.previewId});
  }
  async function saveAssignment(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token),input=body.assignment||{},payload=cleanAssignment(input);
    await validateKnownGroups(db,payload.group_codes);
    if(!input.id){
      if(!uuid(body.operationId))fail('Actualise Gestion des notes pour créer les travaux avec un identifiant d’opération.',409);
      return rpc(db,'cardinal_create_assignment_batch',{p_teacher:teacher.email,p_operation_id:body.operationId,p_assignment:cleanPatch(payload),p_groups:payload.group_codes});
    }
    const before=await snapshot(db,String(input.id)),group=singleGroup(before.assignment);
    if(payload.mozaik_competence_kind!==before.assignment.mozaik_competence_kind)payload.mozaik_competence_code=null;
    if(before.assignment.source_metadata?.mozaik){
      const fields:any={reportCardEnabled:'report_card_enabled',resultsVisible:'mozaik_results_visible',showInSchedule:'mozaik_show_in_schedule',homework:'mozaik_homework',weight:'weight'};
      const overrides=new Set<string>(before.assignment.source_metadata.mozaikOverrides||[]);
      for(const [field,column] of Object.entries(fields) as [string,string][])if(payload[column]!==before.assignment[column])overrides.add(field);
      payload.source_metadata={...before.assignment.source_metadata,mozaikOverrides:[...overrides]};
    }
    if(payload.group_codes.length!==1||payload.group_codes[0]!==group)fail('Un travail enregistré appartient à son groupe. Crée une copie indépendante pour un autre groupe.',409);
    let writes:any[]=[],preview:any=null;
    const maxChanged=payload.max_score!==before.assignment.max_score;
    if(maxChanged&&before.results.some((r:any)=>r.grade!==null)){
      if(!(payload.max_score>0))fail('Un travail comportant des notes doit conserver un maximum valide.');
      const roster=await rosterFor(db,group,before.results);
      preview=core.buildPreview({assignment:before.assignment,results:before.results,roster,scaleMode:'origin',selectedQuestionIds:['scale'],formative:{formativeId:'settings',assignmentId:'settings',sectionId:'settings',groupCode:group,questions:[{id:'scale',possiblePoints:payload.max_score}],students:[]}});
      if(preview.counts.blocked)fail('Certaines notes ne peuvent pas être remises à l’échelle. Vérifie-les avant de modifier le maximum.',409);
      writes=preview.writes;
    }
    const plan={assignmentId:String(input.id),beforeSnapshot:before,assignmentPatch:cleanPatch(payload),groupCode:group,writes,summary:{counts:preview?.counts||{}}};
    const prepared=await storePreview(db,teacher.email,'settings_import',{assignmentId:String(input.id)},plan,preview||{});
    if(preview)return{id:String(input.id),previewRequired:true,...prepared};
    const saved=await rpc(db,'cardinal_confirm_assignment_operation',{p_teacher:teacher.email,p_preview_id:prepared.previewId});
    return{id:saved.assignmentId,...saved};
  }
  async function saveResult(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token),id=String(body.assignmentId||''),email=normalizeEmail(body.email);
    const before=await snapshot(db,id),a=before.assignment,group=singleGroup(a);
    if(!(a.max_score>0))fail('Complète d’abord le maximum de ce travail.');
    const {data:student,error}=await db.from('school_students').select('email,group_code,active').eq('email',email).maybeSingle();
    if(error||!student?.active||student.group_code!==group)fail('Cet élève ne correspond pas au groupe du travail.');
    const grade=body.grade===null||body.grade===''||body.grade===undefined?null:Number(body.grade);
    if(grade!==null&&(!Number.isFinite(grade)||grade<0||grade>a.max_score))fail('La note est hors du barème du travail.');
    const existing=before.results.find((r:any)=>r.student_email===email);
    const rawGrade=body.rawGrade===undefined?grade:Number(body.rawGrade);
    if(body.rawGrade!==undefined&&rawGrade!==null&&(!Number.isFinite(rawGrade)||rawGrade<0||rawGrade>a.max_score||Math.abs(Math.round((rawGrade+Number.EPSILON)*10)/10-grade)>1e-9))fail('La note saisie ne correspond pas à la note arrondie.');
    const sameGrade=existing&&existing.grade===grade&&(body.rawGrade===undefined||rawGrade===grade);
    const baseScore=grade===null?null:sameGrade&&existing.base_score!=null?existing.base_score:rawGrade;
    const baseMax=grade===null?null:sameGrade&&existing.base_max!=null?existing.base_max:a.max_score;
    const sourceKind=grade===null?null:sameGrade&&existing.base_source?existing.base_source:'gestion';
    const write={email,grade,baseScore,baseMax,sourceKind,requiresCurrentMembership:true,response:String(body.response??existing?.response??'').slice(0,60000),feedback:String(body.feedback??existing?.feedback??'').slice(0,12000),visible:body.visible===undefined?(existing?.visible??true):body.visible!==false};
    const plan={assignmentId:id,beforeSnapshot:before,assignmentPatch:{},groupCode:group,writes:[write],summary:{}};
    const prepared=await storePreview(db,teacher.email,'settings_import',{assignmentId:id,email},plan,{});
    await rpc(db,'cardinal_confirm_assignment_operation',{p_teacher:teacher.email,p_preview_id:prepared.previewId});
    return{saved:true,grade,group};
  }
  return{formativePreview,formativeConfirm,saveAssignment,saveResult};
}
