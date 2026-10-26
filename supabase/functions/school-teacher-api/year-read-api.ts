import {yearContext,yearRpc} from '../_shared/school-years.ts';
export function createAnnualReadApi(deps:any){
 const {teacherFromToken,assignmentShape,fail}=deps;
 async function dashboard(db:any,token:string,body:any={}){
  const teacher=await teacherFromToken(db,token),context=await yearContext(db,body.schoolYear,{fallback:true});
  const data=await yearRpc(db,'cardinal_teacher_year_dashboard',{p_year:context.year});
  return{user:{email:teacher.email,name:teacher.name},context,assignments:(data.assignments||[]).map((a:any)=>({...assignmentShape(a),studentCount:a.studentCount,resultCount:a.resultCount,gradedCount:a.gradedCount,average:a.average===null?null:Number(a.average),updatedAt:a.updated_at})),groups:data.groups||{}};
 }
 async function assignment(db:any,token:string,body:any){
  await teacherFromToken(db,token);
  const data=await yearRpc(db,'cardinal_teacher_assignment_read',{p_id:String(body.assignmentId||'')});
  if(!data?.assignment)fail('Travail introuvable.',404);
  const a=data.assignment,context=await yearContext(db,a.school_year,{assignment:a});
  if(a.split_archived){
   const {data:copies,error}=await db.from('school_assignment_splits').select('group_code,assignment_id').eq('old_assignment_id',a.id).order('group_code');
   if(error)fail('Impossible de retrouver les copies de ce travail.',503);
   return{context,splitRequired:true,originalAssignmentId:a.id,copies:(copies||[]).map((c:any)=>({assignmentId:c.assignment_id,groupCode:c.group_code}))};
  }
  return{context,assignment:{...assignmentShape(a),yearStatus:context.status,readOnly:context.readOnly,isActiveYear:context.isActive},students:(data.students||[]).map((s:any)=>({...s,firstName:s.firstName||'',lastName:s.lastName||s.name,grade:s.grade===null||s.grade===undefined?null:Number(s.grade)}))};
 }
 async function overview(db:any,token:string,body:any){
  await teacherFromToken(db,token);const context=await yearContext(db,body.schoolYear),group=String(body.groupCode||'');
  if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/.test(group))fail('Choisis un groupe.',409);
  return{context,...await yearRpc(db,'cardinal_group_year_overview',{p_year:context.year,p_group:group})};
 }
 return{dashboard,assignment,overview};
}
