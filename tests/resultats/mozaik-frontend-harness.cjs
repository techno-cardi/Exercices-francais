// Current coordinated page/server/extension contract; no network or real student data.
const fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const calls=[],sent=[],messages=[],nodes=new Map();let saves=0;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'Envoyer',disabled:false,dataset:{},classList:{remove(){},add(){}}});return nodes.get(id);};
 const alignment={maxScore:70,weight:39,reportCardEnabled:true};
 const assignment={id:'a',title:'Examen',groups:['31'],competenceKind:'lecture',...alignment};
 const payload={group:{code:'31'},assignment:{...assignment,weightSource:'gestion',maximumSource:'gestion',alignmentVersion:1},results:[{email:'test@invalid',grade:5}]};
 const job={jobId:'job',claimToken:'secret',payload};
 const state={teacherToken:'t',extensionReady:true,extensionVersion:'1.3.54',detailGroup:'31',currentAssignment:{...assignment},currentStudents:[{group:'31',grade:5}]};
 const window={postMessage(){},CardinalAssignmentActions:{reviewMozaik:async()=>true,chooseMozaikParameterSources:async()=>({weightSource:'gestion',maximumSource:'gestion',alignmentVersion:1})},CardinalGestionImports:{getLastDestinationWeightInfo:()=>({assignmentId:'a',groupCode:'31',capturedAt:Date.now(),weight:45,maxScore:100,isNew:false}),chooseMozaikDestination:async()=>true}};
 const inspection=p=>({success:true,previewRequired:true,preview:{rows:[],gestionAfter:alignment},weightSource:p.assignment.weightSource||'legacy',weightChoiceVersion:1,maximumSource:p.assignment.maximumSource,alignmentVersion:p.assignment.alignmentVersion,checkpoint:p.checkpoint||{phase:'planned'}});
 const ctx={state,window,HTMLInputElement:class{},document:{getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],activeElement:null},location:{origin:'https://local',reload(){ctx.reloads=(ctx.reloads||0)+1;}},console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},SYNC_ENDPOINT:'sync',TEACHER_ENDPOINT:'teacher',PUBLIC_KEY:'public',pingExtension(){},validateMozaikGrades(){},commitGrade(){},saveAssignmentSettings:async()=>{saves++},refreshSyncState:async()=>{},fillWorkPage(){ctx.fills=(ctx.fills||0)+1;},renderGradeRows(){},refreshTeacherData:async()=>{},collectAssignment:()=>state.currentAssignment,today:()=> '2026-11-13',competenceLabel:()=> 'Lire',notify:m=>messages.push(m),api:async(e,p)=>{
   calls.push(p);
   if(p.action==='status')return{pendingJobs:ctx.pendingJobs||[]};
   if(p.action==='cancelUnwritten')return{mode:ctx.reconcileMode||'cancelled'};
   if(p.action==='teacherAssignment')return{assignment:{...assignment},students:[{group:'31',grade:5}]};
   if(p.action==='prepare'){ctx.destination=p.destination;return{code:'code',resultCount:1,weightSourceAccepted:p.weightSource,maximumSourceAccepted:p.maximumSource,alignmentVersionAccepted:1,...(p.destination&&!ctx.staleServer?{destinationAccepted:p.destination}:{})};}
   if(p.action==='claim'&&ctx.destination)return{...job,payload:{...payload,previousLink:{activityId:ctx.destination.previousActivityId},link:ctx.destination.activityId?{activityId:ctx.destination.activityId}:null}};
   if(['claim','resume'].includes(p.action))return job;
   return{success:true,staleSource:ctx.staleSource,alignmentApplied:!ctx.staleSource,alignment};
 },sendToExtension:async p=>{sent.push(p);return p.reviewOnly?inspection(p):{success:true,verified:true,verifiedCount:1,syncedCount:1,activityId:'remote'}}};
 const source=fs.readFileSync('resultats/app-patch-v14.js','utf8').replace(/\}\)\(\);\s*$/,'window.testSync={runSync};})();');vm.runInNewContext(source,ctx);
 return{ctx,state,window,calls,sent,messages,el,job,inspection,alignment,saves:()=>saves};
}
module.exports={harness};
