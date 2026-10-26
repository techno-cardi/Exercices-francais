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
const realFetch=window.fetch.bind(window);
window.fetch=async function(input,options){const url=new URL(String(input),location.href);if(url.origin===location.origin)return realFetch(input,options);if(url.hostname!=='ojyswaxuqwnqilrvtjll.supabase.co')throw Error('External network disabled in QA');const p=JSON.parse(options?.body||'{}');let body={ok:true};if(p.action==='teacherDashboard')body={...body,user:{email:'synthetic@test.invalid',name:'Essai local'},assignments:[syntheticWork,{...syntheticWork,id:'synthetic32',groups:['32']},{...syntheticWork,id:'synthetic-old',title:'Archive ancienne classe',groups:['OLD']},{...syntheticWork,id:'synthetic-step2',title:'Examen étape 2',term:2}],groups:{31:6,32:6,77:2}};if(p.action==='teacherAssignment')body={...body,assignment:{...syntheticWork,id:p.assignmentId,groups:[p.assignmentId==='synthetic32'?'32':'31']},students:qaStudents(p.assignmentId==='synthetic32'?'32':'31')};if(p.action==='saveResult'){const index=Number(String(p.email).match(/student(\\d+)/)?.[1]);if(Number.isInteger(index))qaGrades[index]=p.grade;}if(p.action==='get')body.students=[];if(p.action==='status')body={...body,links:[],pendingJobs:[]};return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}})};
</script>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');let rel=decodeURIComponent(url.pathname);if(rel==='/')rel='/resultats/index.html';
 const target=path.resolve(root,'.'+rel);if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{let data=fs.readFileSync(target);if(target.endsWith('/resultats/index.html')||target.endsWith('\\resultats\\index.html'))data=Buffer.from(data.toString().replace('<script src="assignment-actions.js',shim+'<script src="assignment-actions.js'));
 const type=target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.html')?'text/html':'application/octet-stream';res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(8769,'127.0.0.1',()=>console.log('Synthetic QA only: http://127.0.0.1:8769/resultats/index.html'));
