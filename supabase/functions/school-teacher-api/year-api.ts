import {hashRosterFiche,yearRpc,yearFailure} from '../_shared/school-years.ts';
export function createYearApi(deps:any) {
  const {teacherFromToken}=deps;
  async function catalog(db:any,token:string){await teacherFromToken(db,token);return yearRpc(db,'cardinal_year_catalog');}
  async function preview(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token),kind=String(body.kind||''),input=body.request||{};
    const request:any={year:Number(input.year)};
    if(!['create','roster','activate','archive','reopen','roster_append'].includes(kind))yearFailure('Opération annuelle invalide.');
    if(kind==='roster'){
      if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>1000)yearFailure('Choisis une liste de 1 à 1000 élèves.');
      request.mode=String(input.mode||'merge');
      const emails=input.rows.map((r:any)=>String(r.email||'').trim().toLowerCase());
      const existing:any[]=[];
      for(let offset=0;offset<emails.length;offset+=100){
        const {data,error}=await db.from('school_students').select('email').in('email',emails.slice(offset,offset+100));
        if(error)yearFailure('Impossible de vérifier les comptes existants.');existing.push(...(data||[]));
      }
      const known=new Set((existing||[]).map((s:any)=>s.email));
      request.rows=[];
      for(const raw of input.rows){
        const email=String(raw.email||'').trim().toLowerCase(),firstName=String(raw.firstName||'').trim(),lastName=String(raw.lastName||'').trim();
        const row:any={email,group:String(raw.group||'').trim(),firstName,lastName,name:String(raw.name||[firstName,lastName].filter(Boolean).join(' ')).trim(),active:raw.active!==false};
        if(!known.has(email))row.ficheHash=await hashRosterFiche(String(raw.fiche||'').trim());
        request.rows.push(row);
      }
    }
    if(kind==='roster_append')request.assignmentId=String(input.assignmentId||'');
    return yearRpc(db,'cardinal_preview_school_year',{p_teacher:teacher.email,p_kind:kind,p_request:request});
  }
  async function confirm(db:any,token:string,body:any){
    const teacher=await teacherFromToken(db,token),id=String(body.previewId||'');
    if(!/^[0-9a-f-]{36}$/i.test(id))yearFailure('Cet aperçu est invalide. Prépare-le à nouveau.');
    return yearRpc(db,'cardinal_confirm_school_year',{p_teacher:teacher.email,p_preview_id:id});
  }
  async function cancelReady(db:any,token:string,body:any){const teacher=await teacherFromToken(db,token);return yearRpc(db,'cardinal_cancel_unclaimed_year_job',{p_teacher:teacher.email,p_id:String(body.jobId||'')});}
  return{catalog,preview,confirm,cancelReady};
}
