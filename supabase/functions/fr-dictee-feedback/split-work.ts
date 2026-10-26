/** Resolve old bookmarks through audited group copies; never read an archived grade. */
export async function resolveDictationWorks(db:any, slug:string, group:string|null = null) {
  const columns='id,title,max_score,group_codes,split_archived';
  const {data:original,error}=await db.from('school_assignments').select(columns).eq('slug',slug).maybeSingle();
  if(error) throw new Error('Impossible de charger le travail.');
  if(!original) return [];
  if(!original.split_archived) return !group || original.group_codes?.includes(group) ? [original] : [];
  let q=db.from('school_assignment_splits').select('assignment_id,group_code').eq('old_assignment_id',original.id);
  if(group) q=q.eq('group_code',group);
  const {data:links,error:linkError}=await q;
  if(linkError) throw new Error('Impossible de retrouver les travaux séparés.');
  const ids=(links||[]).filter((l:any)=>l.assignment_id).map((l:any)=>l.assignment_id);
  if(!ids.length) return [];
  const {data:copies,error:copyError}=await db.from('school_assignments').select(columns).in('id',ids).eq('split_archived',false);
  if(copyError) throw new Error('Impossible de charger les travaux séparés.');
  return (copies||[]).filter((a:any)=>!group || a.group_codes?.includes(group));
}
