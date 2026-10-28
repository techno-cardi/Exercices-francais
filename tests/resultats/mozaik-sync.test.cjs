const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const worker=fs.readFileSync(path.resolve(__dirname,'../../../cardinal-v1332/legacy-service-worker.js'),'utf8');
const source=worker.slice(worker.indexOf('async function syncInsideMozaik('),worker.indexOf('// ===== background-v081.js'));
function setup(options={}) {
 const g={code:'101',establishmentId:'school',groupCourseId:'course2026',groupMatterId:'matter2026',subjectCode:'FR'};
 const activity={id:'activity-1',idGroupe:'matter2026',codeEtape:'1',titre:'Original',custom:'preserve',parametresEvaluation:{evaluee:true,competence:'1',noteMaximale:10,ponderation:15,porteeAuBulletin:true,custom:'preserve'}};
 let persistedPhase='';let rows={customEnvelope:'preserve',eleves:options.nativeRows??[{fiche:1,resultat:'5',commentaire:'retained'},{fiche:2,resultat:options.outsideGrade??'8',special:{code:'ABS'}},{fiche:3,resultat:'ABS',extra:'keep'}]};
 const phases=[];const writes=[];let updates=0;
 const payload={confirmedReview:true,group:g,assignment:{id:'a1',title:'Renamed',term:1,activityDate:'2026-10-26',period:1,maxScore:20,weight:15,reportCardEnabled:true,competenceKind:'lecture'},results:[{email:'a@educ.cscapitale.qc.ca',name:'A',grade:12}],link:{activityId:'activity-1'},syncJob:{jobId:'j1',claimToken:'secret',endpoint:'https://backend/checkpoint',apiKey:'public'}};
 const context={console,setTimeout:f=>{f();return 1},globalThis:{CardinalMozaikMembersV1312:{read:async()=>[{fiche:1,courriel:'a@educ.cscapitale.qc.ca'}]}},fetch:async(url,init)=>{
 const body=init.body?JSON.parse(init.body):null;let out;
 if(url==='https://backend/checkpoint') {const rank=['creating','created','planned','parameters_verified','results_verified','verified'];if(persistedPhase&&rank.indexOf(body.checkpoint.phase)<rank.indexOf(persistedPhase)) return response({ok:false,message:'invalid_job_phase'},409);phases.push(body);out={ok:true,checkpoint:body.checkpoint};if(options.stopApproval&&body.checkpoint.reviewConfirmed===true)return response({ok:false,message:'approval unavailable'},409);if(options.stopPhase===body.checkpoint.phase) return response({ok:false,message:'interrupted'},409);persistedPhase=body.checkpoint.phase;}
 else if(url.endsWith('/competences')) out=[{code:'1',description:'lecture'}];
 else if(url.includes('/planifications/')) out={activites:[{id:'activity-1'}]};
 else if(url.includes('/resultats/')) {if(init.method==='PUT'){writes.push(body);rows=body;}out=rows;}
 else if(init.method==='PUT') {updates++;Object.assign(activity,body);if(options.wrongWeight) activity.parametresEvaluation.ponderation=99;out=activity;}
 else if(init.method==='POST') throw Error('unexpected create');
 else out=options.missing?[]:[activity];
 return response(out);
 }};
 function response(data,status=200){return{ok:status<400,status,text:async()=>JSON.stringify(data)}}
 vm.createContext(context);vm.runInContext(source+';globalThis.run=syncInsideMozaik',context);
 return {payload,phases,writes,activity,run:()=>context.globalThis.run(payload,'token'),get updates(){return updates}};
}
test('linked renamed activity preserves all result rows and unknown fields, rescaling outside numeric rows once',async()=>{const s=setup();const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.writes[0].eleves.length,3);assert.equal(s.writes[0].customEnvelope,'preserve');assert.equal(s.writes[0].eleves[0].commentaire,'retained');assert.equal(s.writes[0].eleves[1].resultat,'16');assert.equal(s.writes[0].eleves[2].resultat,'ABS');assert.equal(s.activity.custom,'preserve');assert.equal(s.activity.parametresEvaluation.custom,'preserve');assert.equal(s.phases.at(-1).checkpoint.phase,'verified');});
test('missing linked activity never adopts title or creates replacement',async()=>{const s=setup({missing:true});const out=await s.run();assert.equal(out.success,false);assert.equal(s.writes.length,0);assert.equal(s.updates,0);});

test('a changed activity identifies conflicting fields without exposing their contents',async()=>{
 const s=setup();s.payload.reviewOnly=true;const preview=await s.run();
 s.payload.checkpoint=preview.checkpoint;s.payload.reviewOnly=false;s.activity.titre='External edit';
 const out=await s.run();assert.equal(out.success,false);assert.equal(s.writes.length,0);assert.equal(s.updates,0);
 assert.deepEqual(Array.from(out.diagnostics.changedActivityFields),['titre']);assert.equal(JSON.stringify(out.diagnostics).includes('External edit'),false);
});

test('database object key ordering does not change the approved activity',async()=>{
 const s=setup();s.payload.reviewOnly=true;const preview=await s.run();
 const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])):v;
 s.payload.checkpoint=reorder(preview.checkpoint);s.payload.reviewOnly=false;
 const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.writes.length,1);
});

test('empty optional Mozaik metadata can be null, omitted or empty without a false edit conflict',async()=>{
 for(const empty of [undefined,'']) {
 const s=setup();s.activity.notePrivee=null;s.activity.notePublique=null;s.activity.parametresEvaluation.idCategoriePonderation=null;
 s.payload.reviewOnly=true;const preview=await s.run();s.payload.checkpoint=preview.checkpoint;s.payload.reviewOnly=false;
 s.activity.notePrivee=empty;s.activity.notePublique=empty;s.activity.parametresEvaluation.idCategoriePonderation=empty;
 const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.writes.length,1);
 }
});

test('nonempty private notes and category edits remain protected against overwrites',async()=>{
 for(const field of ['notePrivee','notePublique','idCategoriePonderation']) {
 const s=setup();s.activity.notePrivee=null;s.activity.notePublique=null;s.activity.parametresEvaluation.idCategoriePonderation=null;
 s.payload.reviewOnly=true;const preview=await s.run();s.payload.checkpoint=preview.checkpoint;s.payload.reviewOnly=false;
 if(field==='idCategoriePonderation')s.activity.parametresEvaluation[field]='category-other';else s.activity[field]='Keep this change';
 const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0);
 }
});
test('weight mismatch blocks result publication',async()=>{const s=setup({wrongWeight:true});const out=await s.run();assert.equal(out.success,false);assert.equal(s.writes.length,0);});
test('durable initial/target checkpoint happens before first parameter write',async()=>{const s=setup({stopPhase:'planned'});const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0);});
test('missing claimed job cannot publish',async()=>{const s=setup();delete s.payload.syncJob;const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0);});
test('retry after parameter write uses frozen initial/target and never rescales twice',async()=>{const options={stopPhase:'parameters_verified'};const s=setup(options);assert.equal((await s.run()).success,false);assert.equal(s.activity.parametresEvaluation.noteMaximale,20);s.payload.checkpoint=s.phases.find(x=>x.checkpoint.phase==='planned').checkpoint;delete options.stopPhase;const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.writes[0].eleves[1].resultat,'16');s.payload.checkpoint=s.phases.at(-1).checkpoint;const retry=await s.run();assert.equal(retry.success,true,retry.message);assert.equal(s.writes.length,1);});
test('explicit linked competence wins over inferred title/kind',async()=>{const s=setup();s.payload.assignment.competenceCode='1';s.payload.assignment.competenceKind='oral';const out=await s.run();assert.equal(out.success,true,out.message)});
test('imported unknown visibility and bulletin metadata preserve native values',async()=>{const s=setup();s.payload.assignment.sourceMetadata={maxScore:10,weight:null,reportCardEnabled:null,resultsVisible:null,showInSchedule:null,homework:null};s.payload.assignment.reportCardEnabled=false;s.payload.assignment.weight=null;s.payload.assignment.resultsVisible=false;s.activity.parametresEvaluation.resultatsDisponibles=true;s.activity.afficheeDansHoraire=true;const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.activity.parametresEvaluation.porteeAuBulletin,true);assert.equal(s.activity.parametresEvaluation.ponderation,15);assert.equal(s.activity.parametresEvaluation.resultatsDisponibles,true);assert.equal(s.activity.afficheeDansHoraire,true)});

test('overflowing outside numeric grades block before parameters or result writes',async()=>{const s=setup({outsideGrade:'9'.repeat(310)});const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0)});
test('same maximum/title/weight still updates and verifies changed visibility and scheduling',async()=>{const s=setup();s.activity.titre='Renamed';s.activity.parametresEvaluation.noteMaximale=20;s.activity.parametresEvaluation.resultatsDisponibles=false;s.activity.dateActivite='2025-01-01';s.activity.afficheeDansHoraire=false;s.payload.assignment.resultsVisible=true;s.payload.assignment.showInSchedule=true;const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.updates,1);assert.equal(s.activity.parametresEvaluation.resultatsDisponibles,true);assert.equal(s.activity.dateActivite,'2026-10-26');assert.equal(s.activity.afficheeDansHoraire,true)});
test('review-only existing activity freezes complete preview including outside rescale without native writes',async()=>{const s=setup();s.payload.reviewOnly=true;const out=await s.run();assert.equal(out.previewRequired,true,out.message);assert.equal(s.updates,0);assert.equal(s.writes.length,0);assert.equal(out.checkpoint.phase,'planned');assert.equal(out.preview.rows.length,3);const row=out.preview.rows.find(r=>r.fiche===2);assert.equal(row.source,'preserved');assert.equal(row.beforeGrade,'8');assert.equal(row.afterGrade,'16');assert.equal(row.action,'rescaled')});
test('review-only new activity makes no native creation or checkpoint creation',async()=>{const s=setup();s.payload.reviewOnly=true;s.payload.link=null;const out=await s.run();assert.equal(out.previewRequired,true,out.message);assert.equal(out.checkpoint,null);assert.equal(s.phases.length,0);assert.equal(s.updates,0);assert.equal(s.writes.length,0)});
test('unconfirmed job always returns preview instead of native writes',async()=>{const s=setup();delete s.payload.confirmedReview;const out=await s.run();assert.equal(out.previewRequired,true,out.message);assert.equal(s.updates,0);assert.equal(s.writes.length,0)});

test('confirmed review must be durably recorded before the first native write',async()=>{const options={};const s=setup(options);s.payload.reviewOnly=true;const review=await s.run();s.payload.checkpoint=review.checkpoint;s.payload.reviewOnly=false;s.payload.confirmedReview=true;options.stopApproval=true;const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0)});

test('unevaluated planned activity with missing maximum and empty results previews and accepts completed Gestion scale',async()=>{const s=setup({nativeRows:[]});s.activity.parametresEvaluation.noteMaximale=null;s.activity.parametresEvaluation.evaluee=false;s.payload.assignment.maxScore=40;s.payload.reviewOnly=true;const preview=await s.run();assert.equal(preview.previewRequired,true,preview.message);assert.equal(preview.preview.activityBefore.parametresEvaluation.noteMaximale,null);assert.equal(preview.preview.activityBefore.parametresEvaluation.evaluee,false);assert.equal(preview.preview.activityAfter.parametresEvaluation.noteMaximale,40);assert.equal(preview.preview.activityAfter.parametresEvaluation.evaluee,true);assert.equal(s.updates,0);s.payload.checkpoint=preview.checkpoint;s.payload.reviewOnly=false;const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.activity.parametresEvaluation.noteMaximale,40);assert.equal(s.writes[0].eleves[0].resultat,'12')});
test('missing native maximum preserves outside special states while publishing incoming graded rows',async()=>{const s=setup({nativeRows:[{fiche:2,resultat:'ABS',special:{code:'absent'}}]});s.activity.parametresEvaluation.noteMaximale=null;s.activity.parametresEvaluation.evaluee=false;s.payload.assignment.maxScore=40;const out=await s.run();assert.equal(out.success,true,out.message);assert.equal(s.writes[0].eleves.find(row=>row.fiche===2).resultat,'ABS');assert.equal(s.writes[0].eleves.find(row=>row.fiche===2).special.code,'absent')});
test('unknown or zero native maximum blocks outside numeric grades including zero before any native writes',async()=>{for(const maximum of [null,0])for(const grade of ['0','8']){const s=setup({nativeRows:[{fiche:2,resultat:grade}]});s.activity.parametresEvaluation.noteMaximale=maximum;s.activity.parametresEvaluation.evaluee=false;s.payload.assignment.maxScore=40;const out=await s.run();assert.equal(out.success,false);assert.equal(s.updates,0);assert.equal(s.writes.length,0);assert.equal(s.phases.length,0)}});
