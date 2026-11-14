const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./mozaik-frontend-harness.cjs');

test('ordinary retry resumes the existing journal and reviews it without creating another job',async()=>{
 const h=harness();h.ctx.pendingJobs=[{jobId:'old',groupCode:'31'}];let choices=0;
 h.window.CardinalGestionImports.chooseMozaikDestination=async()=>{choices++;return true;};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.saves(),0);assert.equal(choices,0);
 assert.equal(h.calls.find(c=>c.action==='resume')?.jobId,'old');assert.equal(h.calls.some(c=>c.action==='prepare'),false);
 assert.equal(h.sent.length,2);assert.equal(h.sent[0].reviewOnly,true);assert.equal(h.window.cardinalActiveSync,false);
});

test('multiple journals never choose an arbitrary destination or write',async()=>{
 const h=harness();h.ctx.pendingJobs=[{jobId:'a',groupCode:'31'},{jobId:'b',groupCode:'31'}];
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0);assert.equal(h.saves(),0);assert.match(h.messages[0],/Plusieurs/);
});

test('an older worker cannot receive dry-run payloads it would mistake for writes',async()=>{
 const h=harness();h.state.extensionVersion='1.3.23';await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0);assert.equal(h.saves(),0);assert.match(h.messages[0],/1\.3\.54/);
});
test('cancelling a fresh native preview releases the unwritten journal without outbound send',async()=>{
 const h=harness();h.window.CardinalAssignmentActions.reviewMozaik=async()=>false;await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,1);assert.equal(h.sent[0].reviewOnly,true);assert.equal(h.calls.find(c=>c.action==='cancelUnwritten')?.jobId,'job');assert.equal(h.calls.some(c=>c.action==='complete'),false);
});
test('cancelling an interrupted journal preserves it because it may have already written',async()=>{
 const h=harness();h.job.payload.checkpoint={phase:'parameters_verified',reviewConfirmed:true};h.window.CardinalAssignmentActions.reviewMozaik=async()=>false;h.ctx.sendToExtension=async p=>{h.sent.push(p);return h.inspection(p);};
 await h.window.testSync.runSync(h.el('resumeMozaikBtn'),'old');
 assert.equal(h.calls.some(c=>c.action==='cancelUnwritten'),false);assert.equal(h.calls.find(c=>c.action==='complete')?.success,false);assert.equal(h.sent.length,1);
});
test('cancelling a resumed pre-write preview releases the journal',async()=>{
 const h=harness();h.job.payload.checkpoint={phase:'planned',reviewConfirmed:false};h.window.CardinalAssignmentActions.reviewMozaik=async()=>false;
 await h.window.testSync.runSync(h.el('resumeMozaikBtn'),'old');assert.equal(h.calls.find(c=>c.action==='cancelUnwritten')?.jobId,'job');assert.equal(h.calls.some(c=>c.action==='complete'),false);
});
test('failed fresh preview releases an unwritten journal so a different destination can be chosen',async()=>{
 const h=harness();h.ctx.sendToExtension=async p=>{h.sent.push(p);return{success:false,message:'État spécial à vérifier'};};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,1);assert.equal(h.calls.find(c=>c.action==='cancelUnwritten')?.jobId,'job');assert.equal(h.calls.some(c=>c.action==='complete'),false);assert.match(h.messages.join(' '),/État spécial/);
});
test('failure after confirmed sending preserves the journal for safe recovery',async()=>{
 const h=harness();h.ctx.sendToExtension=async p=>{h.sent.push(p);if(p.reviewOnly)return h.inspection(p);throw new Error('connexion interrompue');};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.calls.some(c=>c.action==='cancelUnwritten'),false);assert.equal(h.calls.find(c=>c.action==='complete')?.success,false);
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

test('new sends require an explicit Mozaik destination before preparing any job',async()=>{
 const h=harness();let chosen=false;
 h.window.CardinalGestionImports.chooseMozaikDestination=async()=>{assert.equal(h.calls.some(c=>c.action==='prepare'),false);chosen=true;return false;};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(chosen,true);assert.equal(h.sent.length,0);assert.equal(h.calls.some(c=>c.action==='prepare'),false);
});
test('a replacement destination travels into the frozen job without changing an existing association first',async()=>{
 const h=harness();h.state.extensionVersion='1.3.54';h.window.CardinalGestionImports.chooseMozaikDestination=async()=>({previousActivityId:'original',activityId:'replacement'});
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 const p=h.calls.find(c=>c.action==='prepare');assert.deepEqual(JSON.parse(JSON.stringify(p.destination)),{previousActivityId:'original',activityId:'replacement'});
});
test('switching destinations with an older extension is blocked before preparing or writing',async()=>{
 const h=harness();h.state.extensionVersion='1.3.53';h.window.CardinalGestionImports.chooseMozaikDestination=async()=>({previousActivityId:'original',activityId:null});
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.calls.some(c=>c.action==='prepare'),false);assert.equal(h.sent.length,0);assert.match(h.messages.join(' '),/1\.3\.54/);
});
test('a server that ignores the selected destination cannot send to the old activity',async()=>{
 const h=harness();h.state.extensionVersion='1.3.54';h.ctx.staleServer=true;h.window.CardinalGestionImports.chooseMozaikDestination=async()=>({previousActivityId:'original',activityId:'replacement'});
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.calls.some(c=>c.action==='claim'),false);assert.equal(h.sent.length,0);assert.match(h.messages.join(' '),/destination/i);
});
test('a claimed journal with a different destination cannot be sent',async()=>{
 const h=harness();h.state.extensionVersion='1.3.54';h.window.CardinalGestionImports.chooseMozaikDestination=async()=>({previousActivityId:'original',activityId:'replacement'});
 const original=h.ctx.api;h.ctx.api=async(e,p)=>{const result=await original(e,p);if(p.action==='claim')return {...result,payload:{...result.payload,link:{activityId:'wrong'}}};return result;};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0);assert.match(h.messages.join(' '),/destination/i);assert.equal(h.calls.find(c=>c.action==='cancelUnwritten')?.jobId,'job');
});

test('a destination read failure never falls back to creating an activity',async()=>{
 const h=harness();h.window.CardinalGestionImports.chooseMozaikDestination=async()=>{throw new Error('Liste Mozaïk incomplète');};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0);assert.match(h.messages.join(' '),/incomplète/);
});
