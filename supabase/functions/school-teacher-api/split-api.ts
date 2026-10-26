/** Historical split maintenance adapter. No roster is used to infer past membership. */
export function createSplitApi(deps:any) {
  const {teacherFromToken,fail}=deps;
  const uuid=(v:any)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(v||''));
  const messages:any={
    stale_preview:'Le travail ou ses dépendances ont changé. Prépare un nouvel aperçu.',
    preview_expired:'Cet aperçu a expiré. Prépare-le à nouveau.',
    operation_not_found:'Cet aperçu est introuvable. Prépare-le à nouveau.',
    operation_teacher_mismatch:'Cet aperçu appartient à une autre session enseignant.',
    invalid_teacher:'La session enseignant doit être renouvelée.',
    split_unresolved_results:'Attribue explicitement les notes sans groupe historique avant de confirmer.',
    split_historical_group_conflict:'Une attribution contredit le groupe historique enregistré. Vérifie ces notes.',
    split_active_sync_job:'Termine ou résous les envois Mozaïk avant de séparer ce travail.',
    split_unhandled_dependency:'Une référence historique nécessite une résolution avant la séparation.',
    split_requires_shared_assignment:'Ce travail est déjà indépendant ou a déjà été séparé.',
    split_archived_assignment:'Cet ancien identifiant a été séparé. Ouvre la copie correspondant au groupe.',
    unresolved_formative_group:'Confirme le groupe historique de l’association Formative.',
    unresolved_legacy_mozaik_link:'Vérifie le groupe de l’ancien lien Mozaïk avant de séparer le travail.'
  };
  async function rpc(db:any,name:string,args:any){
    const {data,error}=await db.rpc(name,args);
    if(error){
      const key=Object.keys(messages).find(k=>String(error.message||'').includes(k));
      fail(key?messages[key]:'La séparation n’a pas été enregistrée. Vérifie les attributions et prépare un nouvel aperçu.',key&&['invalid_teacher','operation_teacher_mismatch'].includes(key)?401:409);
    }
    return data;
  }
  async function splitPreview(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token);
    if(!uuid(body.assignmentId))fail('Identifiant de travail invalide.');
    const groups=body.resultGroups??{};
    if(!groups||typeof groups!=='object'||Array.isArray(groups)||Object.entries(groups).some(([email,group])=>!email||typeof group!=='string'||!group.trim()))fail('Les attributions historiques doivent indiquer un groupe explicite par élève.');
    const formativeGroup=body.formativeGroupCode==null?null:String(body.formativeGroupCode).trim();
    return rpc(db,'cardinal_preview_assignment_split',{p_teacher:teacher.email,p_assignment_id:body.assignmentId,p_result_groups:groups,p_formative_group:formativeGroup});
  }
  async function splitConfirm(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token);
    if(!uuid(body.previewId))fail('Identifiant d’aperçu invalide. Prépare un nouvel aperçu.');
    return rpc(db,'cardinal_confirm_assignment_split',{p_teacher:teacher.email,p_preview_id:body.previewId});
  }
  return {splitPreview,splitConfirm};
}
