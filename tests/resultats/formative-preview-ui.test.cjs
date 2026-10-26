const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness() {
  const elements = new Map();
  const listeners = {};
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, value:'', textContent:'', innerHTML:'', checked:false, disabled:false, open:false, dataset:{}, options:[], classList:{add(){},remove(){},contains(){return false;},toggle(){}}, addEventListener(type,fn){this[type]=fn;}, showModal(){this.open=true;}, close(){this.open=false;}, add(o){this.options.push(o);}, querySelector(){return null;} });
    return elements.get(id);
  }
  let selected = [{value:'q1'}];
  const calls = []; const notifications = []; const opened = [];
  const assignment = {id:'a1',title:'Travail conservé',groups:['101'],weight:15,term:2,activityDate:'2026-10-01',maxScore:30,formativeScaleMode:'hundred',competenceKind:'lecture',activityType:'Test'};
  const state={teacherToken:'token',extensionVersion:'1.3.24',teacherAssignments:[assignment],currentAssignment:assignment,dashboardGroup:'101',detailGroup:'101'};
  const document = {getElementById:element,querySelector(){return null;},querySelectorAll(){return selected;},addEventListener(t,f){listeners[t]=f;}};
  const window = {addEventListener(t,f){listeners[t]=f;},postMessage(message){this.lastRequest=message;}};
  const context={window,document,state,console,location:{origin:'http://local'},crypto:require('node:crypto').webcrypto,sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},setTimeout(){},clearTimeout(){},setInterval(){},today:()=> '2026-10-26',formatNumber:String,competencyArray:()=>[1],TEACHER_ENDPOINT:'teacher',api:async(e,p)=>{calls.push(p);return context.response;},notify:(...a)=>notifications.push(a),openAssignment:async id=>opened.push(id),fillWorkPage(){},Option:function(text,value){this.text=text;this.value=value;}};
  const source=fs.readFileSync(path.join(__dirname,'../../resultats/formative-integration.js'),'utf8').replace(/\}\)\(\);\s*$/, 'window.testUi = {showImportModal,confirmImport,fillSettingsFromDestination,updateSelectedTotal,pullCurrentAssignment,associateCurrentAssignment};})();');
  vm.runInNewContext(source,context);
  const snapshot={formativeId:'f1',groupCode:'101',title:'Formative source',sectionTitle:'Groupe 101',hierarchy:[{id:'q1',parentId:null,kind:'question'}],questions:[{id:'q1',possiblePoints:30,gradedCount:1,label:'Question'}],students:[]};
  context.response={ok:true,previewId:'p1',expiresAt:'2026-10-27',preview:{rows:[{email:'z@x',name:'Zoé Zola',action:'replace',beforeGrade:20,afterGrade:80,beforeMax:30,targetMaxScore:100},{email:'a@x',name:'Anne Abel',action:'blocked',reason:'Résultat incomplet',beforeGrade:null,afterGrade:null,beforeMax:30,targetMaxScore:100}],counts:{add:0,replace:1,rescale:0,unchanged:0,blocked:1,modified:1},sourceMaxScore:30,targetMaxScore:100,scaleMode:'hundred'}};
  return {ui:window.testUi,window,element,context,calls,listeners,snapshot,opened,notifications};
}
test('existing destination previews before confirming and preserves native settings',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'a1');
 await h.ui.confirmImport();
 assert.equal(h.calls[0].action,'formativePreview');assert.equal(h.calls[0].scaleMode,'hundred');assert.equal(h.calls[0].settings.weight,15);assert.equal(h.opened.length,0);
 assert.equal(h.element('confirmFormativeImport').textContent,'Confirmer l’import');
 assert.match(h.element('formativePreview').innerHTML,/20\/30/);assert.match(h.element('formativePreview').innerHTML,/80\/100/);assert.match(h.element('formativePreview').innerHTML,/Résultat incomplet/);
 assert.ok(h.element('formativePreview').innerHTML.indexOf('Anne Abel')<h.element('formativePreview').innerHTML.indexOf('Zoé Zola'));
 h.context.response={ok:true,assignmentId:'a1',importedCount:1,counts:{}};await h.ui.confirmImport();
 assert.equal(h.calls[1].action,'formativeConfirm');assert.equal(h.calls[1].previewId,'p1');assert.deepEqual(h.opened,['a1']);
});

test('excluding a student prepares a new preview before confirmation',async()=>{
 const h=harness();h.snapshot.students=[{email:'z@x'}];h.ui.showImportModal(h.snapshot,'a1');await h.ui.confirmImport();
 assert.match(h.element('formativePreview').innerHTML,/data-import-email="z@x"/);
 const node={dataset:{importEmail:'z@x'},checked:false};
 h.element('formativePreview').onchange({target:node});await h.ui.confirmImport();
 assert.equal(h.calls[1].action,'formativePreview');
 assert.deepEqual(Array.from(h.calls[1].selectedEmails),[]);
});

test('lost confirmation response retries the same operation instead of creating a new work',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'');await h.ui.confirmImport();
 h.context.api=async(e,p)=>{h.calls.push(p);throw new Error('Connexion interrompue');};
 await h.ui.confirmImport();await h.ui.confirmImport();
 assert.deepEqual(h.calls.map(c=>c.action),['formativePreview','formativeConfirm','formativeConfirm']);
 assert.equal(h.calls[1].previewId,h.calls[2].previewId);
});

test('expired confirmation can prepare a fresh preview without changing a selection',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'a1');await h.ui.confirmImport();
 h.context.api=async(e,p)=>{h.calls.push(p);throw new Error('Cet aperçu a expiré. Prépare-le à nouveau.');};await h.ui.confirmImport();
 await h.ui.confirmImport();assert.equal(h.calls[2].action,'formativePreview');
});

test('old extension is refused before preparing or confirming grades',async()=>{
 const h=harness();h.context.state.extensionVersion='1.3.23';h.ui.showImportModal(h.snapshot);await h.ui.confirmImport();assert.equal(h.calls.length,0);assert.match(h.element('formativeImportWarning').textContent,/1\.3\.24/);
});

test('legacy pending source is re-read once with its exact class before preview',async()=>{
 const h=harness();const old={...h.snapshot};delete old.hierarchy;h.ui.showImportModal(old);const work=h.ui.confirmImport();const request=h.window.lastRequest;
 assert.equal(request.action,'pull');assert.equal(h.calls.length,0);
 h.listeners.message({source:h.window,origin:'http://local',data:{source:'cardinal-formative-extension',type:'FORMATIVE_EXTENSION_RESULT',requestId:request.requestId,result:{ok:true,payload:h.snapshot}}});await work;
 assert.match(h.element('formativeImportState').textContent,/actualisées/);await h.ui.confirmImport();assert.equal(h.calls[0].action,'formativePreview');
});

test('multipart parent totals are hidden while leaf questions remain selectable',()=>{
 const h=harness();h.snapshot.questions=[{id:'parent',label:'Total parent',possiblePoints:10,gradedCount:1},{id:'q1',parentId:'parent',label:'Sous-question',possiblePoints:10,gradedCount:1}];h.ui.showImportModal(h.snapshot);
 assert.doesNotMatch(h.element('formativeQuestionList').innerHTML,/value="parent"/);assert.match(h.element('formativeQuestionList').innerHTML,/value="q1" checked/);
});
test('changing a question invalidates preview without making a request',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'a1');await h.ui.confirmImport();h.ui.updateSelectedTotal();assert.equal(h.calls.length,1);await h.ui.confirmImport();assert.equal(h.calls[1].action,'formativePreview');
});
test('group changes discard late previews and require reopening',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'a1');let resolve;h.context.api=(e,p)=>{h.calls.push(p);return new Promise(r=>resolve=r);};const work=h.ui.confirmImport();h.listeners['cardinal-group-changed']({detail:{group:'102'}});resolve(h.context.response);await work;assert.equal(h.element('formativeImportDialog').open,false);assert.notEqual(h.element('confirmFormativeImport').textContent,'Confirmer l’import');await h.ui.confirmImport();assert.equal(h.calls.length,1);
});
test('preview errors never fall back to legacy writes',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot,'a1');h.context.api=async(e,p)=>{h.calls.push(p);throw new Error('Serveur indisponible');};await h.ui.confirmImport();assert.deepEqual(h.calls.map(c=>c.action),['formativePreview']);assert.match(h.element('formativeImportWarning').textContent,/Serveur indisponible/);
});
test('missing maxima remain incomplete and existing settings stay read-only',()=>{
 const h=harness();h.context.state.teacherAssignments[0].maxScore=null;h.ui.showImportModal(h.snapshot,'a1');assert.match(h.element('formativeDestinationSummary').textContent,/À compléter/);assert.equal(h.element('formativeWeight').disabled,true);assert.equal(h.element('formativeImportDialog').dataset.cardinalNativeDestinationV2,'1');
});

test('unknown question maximum displays incomplete instead of a fabricated zero',()=>{
 const h=harness();h.snapshot.questions[0].possiblePoints=null;h.ui.showImportModal(h.snapshot);assert.match(h.element('formativeSelectedTotal').textContent,/À compléter/);assert.match(h.element('formativeQuestionList').innerHTML,/À compléter/);
});
test('a late extension pull cannot reopen an import after navigating away',async()=>{
 const h=harness();h.context.state.currentAssignment.formativeId='f1';const pulling=h.ui.pullCurrentAssignment();const request=h.window.lastRequest;h.context.state.currentAssignment={id:'a2',groups:['102']};h.context.state.dashboardGroup='102';h.listeners['cardinal-group-changed']({detail:{group:'102'}});h.listeners.message({source:h.window,origin:'http://local',data:{source:'cardinal-formative-extension',type:'FORMATIVE_EXTENSION_RESULT',requestId:request.requestId,result:{ok:true,payload:h.snapshot}}});await pulling;assert.equal(h.element('formativeImportDialog').open,false);assert.equal(h.calls.length,0);
});
test('new imports use the frozen current group and origin scale by default',async()=>{
 const h=harness();h.ui.showImportModal(h.snapshot);await h.ui.confirmImport();assert.equal(h.calls[0].scaleMode,'origin');assert.equal(h.calls[0].destinationAssignmentId,'');assert.deepEqual(Array.from(h.calls[0].settings.groups),['101']);
});
test('incomplete existing dates stay missing in preview settings',async()=>{
 const h=harness();h.context.state.teacherAssignments[0].activityDate=null;h.ui.showImportModal(h.snapshot,'a1');await h.ui.confirmImport();assert.equal(h.calls[0].settings.activityDate,null);
});
test('a single known Formative link proposes its current-group destination without locking selection',()=>{
 const h=harness();h.context.state.teacherAssignments[0].formativeId='f1';h.ui.showImportModal(h.snapshot);assert.equal(h.element('formativeDestination').value,'a1');assert.equal(h.element('formativeDestination').disabled,false);assert.equal(h.element('formativeScaleMode').value,'hundred');
});
test('preview warnings expose changed links as escaped text before confirmation',async()=>{
 const h=harness();h.context.response.preview.warnings=['Le lien sera remplacé <script>'];h.ui.showImportModal(h.snapshot,'a1');await h.ui.confirmImport();assert.match(h.element('formativePreview').innerHTML,/Le lien sera remplacé &lt;script&gt;/);assert.doesNotMatch(h.element('formativePreview').innerHTML,/<script>/);
});

test('shared historical works cannot be selected or suggested as import destinations',()=>{
 const h=harness();h.context.state.teacherAssignments[0].groups=['101','102'];h.context.state.teacherAssignments[0].formativeId='f1';h.ui.showImportModal(h.snapshot);
 assert.equal(h.element('formativeDestination').value,'');
 assert.match(h.element('formativeDestination').innerHTML,/<option value="a1" disabled>.*Séparer les groupes/);
});

test('preview derives the modification count from add, replace and rescale totals',async()=>{
 const h=harness();delete h.context.response.preview.counts.modified;h.context.response.preview.counts.add=26;h.context.response.preview.counts.replace=0;
 h.ui.showImportModal(h.snapshot);await h.ui.confirmImport();
 assert.match(h.element('formativePreview').innerHTML,/Toutes · 26 modifications/);
});

test('global import helper preserves native preview and confirmation labels',()=>{
 const h=harness();h.ui.showImportModal(h.snapshot);let apply;
 h.context.MutationObserver=class {constructor(fn){apply=fn;}observe(){}};
 h.context.requestAnimationFrame=fn=>fn();h.context.sessionStorage.getItem=()=>JSON.stringify({formativeId:'f1'});
 h.context.document.querySelectorAll=()=>[];
 h.context.document.querySelector=()=>({});
 h.element('formativeSummary').appendChild=()=>{};
 h.context.document.createElement=()=>({dataset:{}});
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../resultats/formative-global-v01.js'),'utf8'),h.context);
 apply();assert.equal(h.element('confirmFormativeImport').textContent,'Prévisualiser les notes');
});
