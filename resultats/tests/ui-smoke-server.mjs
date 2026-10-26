// Manual browser QA with synthetic data only; never forwards an API request.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const shim=`<script>
localStorage.setItem('results_teacher_token','synthetic-local');localStorage.setItem('results_dashboard_group','31');
const syntheticWork={id:'synthetic31',title:'Examen de lecture',groups:['31'],competenceKind:'lecture',competencies:['Lecture'],maxScore:30,weight:15,term:1,activityDate:'2026-10-26',published:false,resultsVisible:true,showInSchedule:true,period:3,studentCount:6,gradedCount:5,average:14.0998,revision:1};
const qaGrades=[0,17.999,18,22.5,null,12];
const qaStudents=group=>qaGrades.map((grade,i)=>({email:'student'+i+'@test.invalid',name:['Alice Alpha','Bob Bêta','Carol Charles','Dan Dubois','Éva Élie','François Fortin'][i],firstName:['Alice','Bob','Carol','Dan','Éva','François'][i],lastName:['Alpha','Bêta','Charles','Dubois','Élie','Fortin'][i],group,grade,feedback:'Commentaire synthétique conservé',response:'Réponse synthétique',visible:true}));
let qaActiveYear=2026;const qaYears=[{year:2026,label:'2026–2027',status:'open',studentCount:6,assignmentCount:4},{year:2027,label:'2027–2028',status:'draft',studentCount:2,assignmentCount:0}];
const qaCatalog=()=>({activeYear:qaActiveYear,enforced:true,years:qaYears,pendingJobs:[]});
const qaContext=year=>({...qaYears.find(y=>y.year===year),year,activeYear:qaActiveYear,isActive:year===qaActiveYear,readOnly:qaYears.find(y=>y.year===year)?.status!=='open',catalog:qaCatalog()});
let qaFailNextSave=new URLSearchParams(location.search).has('qa-fail');const qaWorkGrades={synthetic31:qaGrades,'synthetic-step2':[...qaGrades],syntheticOral:[...qaGrades]};
const realFetch=window.fetch.bind(window);
window.fetch=async function(input,options){const url=new URL(String(input),location.href);if(url.origin===location.origin)return realFetch(input,options);if(url.hostname!=='ojyswaxuqwnqilrvtjll.supabase.co')throw Error('External network disabled in QA');const p=JSON.parse(options?.body||'{}');const year=Number(p.schoolYear||qaActiveYear);let body={ok:true};if(p.action==='teacherDashboard')body={...body,context:qaContext(year),user:{email:'synthetic@test.invalid',name:'Essai local'},assignments:[syntheticWork,{...syntheticWork,id:'synthetic32',groups:['32']},{...syntheticWork,id:'synthetic-old',title:'Archive ancienne classe',groups:['OLD']},{...syntheticWork,id:'synthetic-step2',title:'Examen étape 2',term:2}],groups:year===2026?{31:6,32:6,77:2}:{31:2}};if(p.action==='teacherDashboard'&&year!==2026)body.assignments=[];if(p.action==='teacherAssignment')body={...body,context:qaContext(year),assignment:{...syntheticWork,schoolYear:year,readOnly:qaContext(year).readOnly,isActiveYear:qaContext(year).isActive,id:p.assignmentId,groups:[p.assignmentId==='synthetic32'?'32':'31']},students:qaStudents(p.assignmentId==='synthetic32'?'32':'31')};if(p.action==='schoolYearCatalog')body={...body,...qaCatalog()};
if(p.action==='groupYearOverview')body={...body,context:qaContext(year),schoolYear:year,groupCode:p.groupCode,assignments:year===2026?[{...syntheticWork,id:'syntheticOral',title:'Communication orale',competenceKind:'oral'},syntheticWork,{...syntheticWork,id:'synthetic-step2',title:'Production écrite',competenceKind:'ecriture',term:2}]:[],students:qaStudents(p.groupCode).map(s=>({...s,results:Object.fromEntries(Object.entries(qaWorkGrades).map(([id,grades])=>[id,{grade:grades[Number(s.email.match(/student(\\d+)/)?.[1])]}]))}))};
if(p.action==='schoolYearPreview')body={...body,previewId:'synthetic-preview',preview:{kind:p.kind,year:p.request.year,activeYear:qaActiveYear,rowCount:p.request.rows?.length||0,groupCount:1,newStudents:0,knownStudents:p.request.rows?.length||0,mode:p.request.mode,studentCount:2,preservedAssignments:4,preservedResults:6}};
if(p.action==='schoolYearConfirm'){qaYears[0].status='archived';qaYears[1].status='open';qaActiveYear=2027;body={...body,kind:'activate',year:2027,activeYear:2027};}
if(p.action==='saveResult'){const index=Number(String(p.email).match(/student(\\d+)/)?.[1]);if(qaFailNextSave){qaFailNextSave=false;return new Response(JSON.stringify({ok:false,message:'Conflit de test : la note a changé.'}),{status:409,headers:{'Content-Type':'application/json'}});}if(Number.isInteger(index))(qaWorkGrades[p.assignmentId]||qaGrades)[index]=p.grade;}if(p.action==='get')body.students=[];if(p.action==='status')body={...body,links:[],pendingJobs:[]};return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}})};
</script>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');let rel=decodeURIComponent(url.pathname);if(rel==='/')rel='/resultats/index.html';
 const target=path.resolve(root,'.'+rel);if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{let data=fs.readFileSync(target);if(target.endsWith('/resultats/index.html')||target.endsWith('\\resultats\\index.html'))data=Buffer.from(data.toString().replace('<script src="assignment-actions.js',shim+'<script src="assignment-actions.js'));
 const type=target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.html')?'text/html':'application/octet-stream';res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(8769,'127.0.0.1',()=>console.log('Synthetic QA only: http://127.0.0.1:8769/resultats/index.html'));
