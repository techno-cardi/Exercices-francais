const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./mozaik-frontend-harness.cjs');

test('old extension cannot ignore explicit weight authority',async()=>{
 const h=harness();h.state.extensionVersion='1.3.52';
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.sent.length,0);assert.equal(h.calls.some(c=>c.action==='prepare'),false);
 assert.match(h.messages.join(' '),/1\.3\.54/);
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
 const h=harness();h.window.CardinalAssignmentActions.chooseMozaikParameterSources=async()=>{h.state.currentAssignment={id:'different',groups:['31']};return {weightSource:'gestion',maximumSource:'gestion',alignmentVersion:1};};
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

test('both maximum and weight acknowledgements are required before claiming',async()=>{
 for(const key of ['maximumSourceAccepted','alignmentVersionAccepted']){
  const h=harness(),api=h.ctx.api;h.ctx.api=async(e,p)=>{const out=await api(e,p);if(p.action==='prepare')delete out[key];return out;};
  await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,0,key);assert.equal(h.calls.some(p=>p.action==='claim'),false);
 }
});
test('a preview with another maximum source is never sent',async()=>{
 const h=harness();h.ctx.sendToExtension=async p=>{h.sent.push(p);return{...h.inspection(p),maximumSource:'mozaik'};};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.sent.length,1);assert.equal(h.sent.some(p=>p.confirmedReview),false);
});
test('successful completion refreshes the actual persisted Gestion state',async()=>{
 const h=harness();await h.window.testSync.runSync(h.el('syncMozaikBtn'));
 assert.equal(h.calls.filter(p=>p.action==='teacherAssignment').length,1);assert.equal(h.ctx.fills,1);assert.equal(h.state.currentAssignment.maxScore,70);
});
test('failed post-alignment refresh keeps old editor locked until reload',async()=>{
 const h=harness(),api=h.ctx.api;h.ctx.api=async(e,p)=>{if(p.action==='teacherAssignment')throw Error('offline');return api(e,p);};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.window.cardinalAlignmentReloadRequired,true);assert.equal(h.el('assignmentDetail').inert,true);
 assert.equal(h.messages.some(m=>/Synchronisation réussie/.test(m)),false);
});
test('page editor is locked while native writes and finalization can change its scale',async()=>{
 const h=harness(),send=h.ctx.sendToExtension;let locked;
 h.ctx.sendToExtension=async p=>{if(!p.reviewOnly)locked=h.el('assignmentDetail').inert;return send(p);};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(locked,true);assert.equal(h.el('assignmentDetail').inert,false);
});
test('lost completion acknowledgment does not unlock stale local scores',async()=>{
 const h=harness(),api=h.ctx.api;h.ctx.api=async(e,p)=>{if(p.action==='complete')throw Error('response lost');return api(e,p);};
 await h.window.testSync.runSync(h.el('syncMozaikBtn'));assert.equal(h.window.cardinalAlignmentReloadRequired,true);assert.equal(h.el('assignmentDetail').inert,true);
});
