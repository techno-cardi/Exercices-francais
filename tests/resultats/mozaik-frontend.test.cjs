const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const calls=[],sent=[],messages=[],nodes=new Map();let saves=0;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'Envoyer',disabled:false,dataset:{},classList:{remove(){},add(){}}});return nodes.get(id);};
 const payload={group:{code:'31'},assignment:{id:'a',title:'Examen'},results:[{email:'test@invalid',grade:5}]};
 const job={jobId:'job',claimToken:'secret',payload};
 const state={teacherToken:'t',extensionReady:true,extensionVersion:'1.3.24',detailGroup:'31',currentAssignment:{id:'a',groups:['31'],competenceKind:'lecture'},currentStudents:[{group:'31',grade:5}]};
 const window={postMessage(){},CardinalAssignmentActions:{reviewMozaik:async()=>true}};
 const ctx={state,window,HTMLInputElement:class{},document:{getElementById:el,querySelector:()=>null,activeElement:null},location:{origin:'https://local'},console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},SYNC_ENDPOINT:'sync',PUBLIC_KEY:'public',pingExtension(){},validateMozaikGrades(){},commitGrade(){},saveAssignmentSettings:async()=>{saves++},refreshSyncState:async()=>{},collectAssignment:()=>state.currentAssignment,today:()=> '2026-10-26',competenceLabel:()=> 'Lire',notify:m=>messages.push(m),api:async(e,p)=>{calls.push(p);if(p.action==='status')return{pendingJobs:ctx.pendingJobs||[]};if(p.action==='prepare')return{code:'code',resultCount:1};if(['claim','resume'].includes(p.action))return job;return{success:true,staleSource:ctx.staleSource}},sendToExtension:async p=>{sent.push(p);return p.reviewOnly?{success:true,previewRequired:true,preview:{rows:[]},checkpoint:{phase:'planned'}}:{success:true,verified:true,verifiedCount:1,syncedCount:1,activityId:'remote'}}};
 const source=fs.readFileSync('resultats/app-patch-v14.js','utf8').replace(/\}\)\(\);\s*$/,'window.testSync={runSync};})();');vm.runInNewContext(source,ctx);
 return{ctx,state,window,calls,sent,messages,el,job,saves:()=>saves};
}
test('ordinary retry detects an interrupted journal before saving or sending',async()=>{
 const h=harness();h.ctx.pendingJobs=[{jobId:'old',groupCode:'31'}];await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.saves(),0);assert.equal(h.sent.length,0);assert.match(h.messages[0],/Reprendre/);assert.equal(h.window.cardinalActiveSync,false);
});

test('an older worker cannot receive dry-run payloads it would mistake for writes',async()=>{
 const h=harness();h.state.extensionVersion='1.3.23';await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0);assert.equal(h.saves(),0);assert.match(h.messages[0],/1\.3\.24/);
});
test('cancelling native preview performs no confirmed outbound send',async()=>{
 const h=harness();h.window.CardinalAssignmentActions.reviewMozaik=async()=>false;await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,1);assert.equal(h.sent[0].reviewOnly,true);assert.equal(h.calls.find(c=>c.action==='complete').success,false);
});
test('confirmation passes the same claim and frozen checkpoint and requires verified counts',async()=>{
 const h=harness();await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,2);assert.equal(h.sent[1].confirmedReview,true);assert.equal(h.sent[1].checkpoint.phase,'planned');assert.equal(h.sent[0].syncJob.jobId,h.sent[1].syncJob.jobId);const completed=h.calls.find(c=>c.action==='complete');assert.equal(completed.verified,true);assert.equal(completed.verifiedCount,1);
});
test('journal resume preserves its revision instead of saving settings again',async()=>{
 const h=harness();await h.window.testSync.runSync(h.el('resumeMozaikBtn'),'old');assert.equal(h.saves(),0);assert.equal(h.calls.some(c=>c.action==='prepare'),false);assert.equal(h.calls.some(c=>c.action==='resume'),true);
});
test('reconciling an old source never announces latest grades synchronized',async()=>{
 const h=harness();h.ctx.staleSource=true;await h.window.testSync.runSync(h.el('recoverMozaikBtn'),'',{...h.job,payload:{...h.job.payload,reconcilingStale:true}});assert.equal(h.saves(),0);assert(h.messages.some(m=>/restent à envoyer/.test(m)));assert.equal(h.messages.some(m=>/Synchronisation réussie/.test(m)),false);
});
