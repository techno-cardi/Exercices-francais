const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const calls=[],sent=[],messages=[],nodes=new Map();let saves=0;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'Envoyer',disabled:false,dataset:{},classList:{remove(){},add(){}}});return nodes.get(id);};
 const payload={group:{code:'31'},assignment:{id:'a',title:'Examen',weightSource:'gestion'},results:[{email:'test@invalid',grade:5}]};
 const job={jobId:'job',claimToken:'secret',payload};
 const state={teacherToken:'t',extensionReady:true,extensionVersion:'1.3.53',detailGroup:'31',currentAssignment:{id:'a',groups:['31'],competenceKind:'lecture'},currentStudents:[{group:'31',grade:5}]};
 const window={postMessage(){},CardinalAssignmentActions:{reviewMozaik:async()=>true,chooseMozaikWeightSource:async()=> 'gestion'},CardinalGestionImports:{getLastDestinationWeightInfo:()=>({assignmentId:'a',groupCode:'31',capturedAt:Date.now(),weight:45,maxScore:70,isNew:false}),chooseMozaikDestination:async()=>true}};
 const ctx={state,window,HTMLInputElement:class{},document:{getElementById:el,querySelector:()=>null,activeElement:null},location:{origin:'https://local'},console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},SYNC_ENDPOINT:'sync',PUBLIC_KEY:'public',pingExtension(){},validateMozaikGrades(){},commitGrade(){},saveAssignmentSettings:async()=>{saves++},refreshSyncState:async()=>{},collectAssignment:()=>state.currentAssignment,today:()=> '2026-10-26',competenceLabel:()=> 'Lire',notify:m=>messages.push(m),api:async(e,p)=>{calls.push(p);if(p.action==='status')return{pendingJobs:ctx.pendingJobs||[]};if(p.action==='cancelUnwritten')return{mode:ctx.reconcileMode||'cancelled'};if(p.action==='prepare'){ctx.destination=p.destination;return{code:'code',resultCount:1,weightSourceAccepted:p.weightSource,...(p.destination&&!ctx.staleServer?{destinationAccepted:p.destination}:{})};}if(p.action==='claim'&&ctx.destination)return{...job,payload:{...payload,previousLink:{activityId:ctx.destination.previousActivityId},link:ctx.destination.activityId?{activityId:ctx.destination.activityId}:null}};if(['claim','resume'].includes(p.action))return job;return{success:true,staleSource:ctx.staleSource}},sendToExtension:async p=>{sent.push(p);return p.reviewOnly?{success:true,previewRequired:true,preview:{rows:[]},weightSource:p.assignment.weightSource||'legacy',weightChoiceVersion:1,checkpoint:{phase:'planned'}}:{success:true,verified:true,verifiedCount:1,syncedCount:1,activityId:'remote'}}};
 const source=fs.readFileSync('resultats/app-patch-v14.js','utf8').replace(/\}\)\(\);\s*$/,'window.testSync={runSync};})();');vm.runInNewContext(source,ctx);
 return{ctx,state,window,calls,sent,messages,el,job,saves:()=>saves};
}

test('old extension cannot ignore explicit weight authority',async()=>{
 const h=harness();h.state.extensionVersion='1.3.52';
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,0);assert.equal(h.calls.some(c=>c.action==='prepare'),false);
 assert.match(h.messages.join(' '),/1\.3\.53/);
});
test('server missing weight acknowledgement stops before claim or extension',async()=>{
 const h=harness(),original=h.ctx.api;
 h.ctx.api=async(e,p)=>{const out=await original(e,p);if(p.action==='prepare')delete out.weightSourceAccepted;return out;};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,0);assert.equal(h.calls.some(c=>c.action==='claim'),false);
 assert.match(h.messages.join(' '),/pondération/);
});
test('claimed source differing from user selection is cancelled without external write',async()=>{
 const h=harness(),original=h.ctx.api;
 h.ctx.api=async(e,p)=>{const out=await original(e,p);return p.action==='claim'?{...out,payload:{...out.payload,assignment:{...out.payload.assignment,weightSource:'mozaik'}}}:out;};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,0);assert(h.calls.some(c=>c.action==='cancelUnwritten'));
});
test('legacy worker preview without authority receipt cannot be confirmed',async()=>{
 const h=harness();h.ctx.sendToExtension=async p=>{h.sent.push(p);return{success:true,previewRequired:true,preview:{rows:[]},checkpoint:{phase:'planned'}};};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,1);assert.equal(h.sent.some(p=>p.confirmedReview),false);
 assert.match(h.messages.join(' '),/pondération|compatible/);
});
test('source choice does not follow teacher to a changed assignment',async()=>{
 const h=harness();h.window.CardinalAssignmentActions.chooseMozaikWeightSource=async()=>{h.state.currentAssignment={id:'different',groups:['31']};return 'gestion';};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.calls.some(c=>c.action==='prepare'),false);assert.equal(h.sent.length,0);
});
test('current protocol reaches reviewed write and complete',async()=>{
 const h=harness();await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,2);assert.equal(h.sent[1].confirmedReview,true);
 assert.equal(h.calls.find(c=>c.action==='complete').verified,true);
});
test('resume cannot send a different assignment or group returned by the server',async()=>{
 for(const field of ['assignment','group']){
  const h=harness(),original=h.ctx.api;
  h.ctx.api=async(e,p)=>{const out=await original(e,p);if(p.action!=='resume')return out;
   return {...out,payload:{...out.payload,[field]:{...out.payload[field],...(field==='assignment'?{id:'other'}:{code:'32'})}}};};
  await h.window.testSync.runSync(h.el('resumeMozaikBtn'),'job');
  assert.equal(h.sent.length,0,field+' mismatch must stop before external request');
 }
});
test('recovery locks navigation before fetching old frozen job',async()=>{
 const h=harness();h.el('recoverMozaikBtn').dataset.jobId='job';let wasLocked=false;
 const original=h.ctx.api;h.ctx.api=async(e,p)=>{if(p.action==='reconcileStale'){wasLocked=h.window.cardinalActiveSync===true;return{...h.job,mode:'reconcile'};}return original(e,p);};
 await h.el('recoverMozaikBtn').onclick();assert.equal(wasLocked,true);assert.equal(h.window.cardinalActiveSync,false);
});
