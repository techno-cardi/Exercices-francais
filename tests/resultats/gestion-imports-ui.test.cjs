const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function harness(){
 const nodes=new Map(),listeners={},calls=[],opened=[];
 function el(id){if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',disabled:false,open:false,value:'',dataset:{},addEventListener(t,f){this['on'+t]=f;},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();}});return nodes.get(id);}
 const window={addEventListener(t,f){listeners[t]=f;},postMessage(m){this.sent=m;}};
 const state={teacherToken:'t',extensionReady:true,extensionVersion:'1.3.24',dashboardGroup:'101',detailGroup:'101',navigationRevision:1,currentAssignment:{id:'old',groups:['101','102'],title:'Ancien'}};
 const context={window,state,document:{getElementById(id){return id==='gestionImportsDialog' ? nodes.get(id)||null : el(id);},createElement(){return el('gestionImportsDialog');},body:{appendChild(){}}},location:{origin:'https://local'},crypto:require('node:crypto').webcrypto,setTimeout(){return 1;},clearTimeout(){},TEACHER_ENDPOINT:'api',api:async(e,p)=>{calls.push(p);return context.response;},refreshTeacherData:async()=>{},openAssignment:async id=>opened.push(id),notify(){}};
 const source=fs.readFileSync(path.join(__dirname,'../../resultats/gestion-imports.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.testImports={submit,change};})();');
 vm.runInNewContext(source,context);
 return{context,window,state,el,listeners,calls,opened,ui:window.testImports};
}
function deliver(h,result){h.listeners.message({source:h.window,origin:'https://local',data:{source:'cardinal-mozaik-extension',type:'MOZAIK_EXTENSION_PLANNED_ACTIVITIES_RESULT',requestId:h.window.sent.requestId,result}});}
function snapshot(){return{ok:true,scope:{groupCode:'101',schoolYear:'2026',schoolId:'s',subjectId:'f',mozaikGroupId:'g'},activities:[],complete:true};}
test('compact Mozaik list sorts missing first and bulk action selects only confirmed missing works',async()=>{
 const h=harness();h.context.response={preview:{rows:[
  {activityId:'linked',title:'Existing linked',status:'linked',selectable:false},
  {activityId:'similar',title:'Similar title',status:'already_exists',selectable:true,candidates:[{id:'a',title:'A'}]},
  {activityId:'missing',title:'Missing work',status:'missing',selectable:true}
 ]}};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,snapshot());await work;
 const html=h.el('gestionImportsContent').innerHTML;
 assert.match(html,/✅ Déjà importé/);assert.match(html,/✅ Déjà présent/);assert.match(html,/gestion-metadata-list/);
 assert.match(html,/1 travail manquant/);assert.doesNotMatch(html,/travails/);
 assert.ok(html.indexOf('Missing work')<html.indexOf('Existing linked'));
 assert.match(html,/Importer tous les manquants/);
 h.ui.change({target:{dataset:{activity:'similar'},value:'associate:a'}});
 h.ui.change({target:{dataset:{activity:'missing'},value:''}});
 h.context.response={previewId:'bulk',preview:{}};
 await h.el('gestionImportsAllMissing').onclick();
 const selections=h.calls.at(-1).selections;
 assert.deepEqual(JSON.parse(JSON.stringify(selections)),[{activityId:'missing',mode:'create'}]);
 assert.equal(h.calls.at(-1).action,'mozaikPreview');
 assert.equal(h.el('gestionImportsSubmit').textContent,'Confirmer l’import des travaux');
});
test('metadata import lists first, previews selected metadata, then confirms',async()=>{
 const h=harness();h.context.response={preview:{rows:[{activityId:'m',title:'<Titre>',status:'missing',selectable:true,metadata:{maxScore:null}}]}};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,snapshot());await work;
 assert.equal(h.calls[0].action,'mozaikPreview');assert.equal(h.calls[0].selections,undefined);
 assert.match(h.el('gestionImportsContent').innerHTML,/&lt;Titre&gt;/);assert.match(h.el('gestionImportsContent').innerHTML,/À compléter/);
 h.context.response={previewId:'p',preview:{rows:[]}};await h.ui.submit();assert.equal(h.calls[1].action,'mozaikPreview');assert.equal(h.calls[1].selections[0].mode,'create');
 h.context.response={assignments:[{assignmentId:'new',groupCode:'101'}]};await h.ui.submit();assert.equal(h.calls[2].action,'mozaikConfirm');assert.equal(h.calls[2].previewId,'p');
});
test('ambiguous candidates never become an automatic selection',async()=>{
 const h=harness();h.context.response={preview:{rows:[{activityId:'m',title:'Même titre',status:'ambiguous',selectable:true,candidates:[{id:'a',title:'A'},{id:'b',title:'B'}]}]}};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,snapshot());await work;await h.ui.submit();assert.equal(h.calls.length,1);
 h.ui.change({target:{dataset:{activity:'m'},value:'associate:b'}});h.context.response={previewId:'p',preview:{rows:[]}};await h.ui.submit();assert.equal(h.calls[1].selections[0].assignmentId,'b');
});
test('closing or switching groups rejects late extension responses',async()=>{
 const h=harness();const work=h.window.CardinalGestionImports.openMozaik();h.state.dashboardGroup='102';h.listeners['cardinal-group-changed']();deliver(h,snapshot());await work;assert.equal(h.calls.length,0);assert.equal(h.el('gestionImportsDialog').open,false);
});
test('split attribution must produce a new preview before confirmation',async()=>{
 const h=harness();h.context.response={previewId:'p',preview:{groups:[{groupCode:'101',resultCount:0,linkCount:0},{groupCode:'102',resultCount:1,linkCount:0}],unresolvedEmails:['x@x'],blockers:[],canConfirm:false}};
 await h.window.CardinalGestionImports.splitCurrent();assert.match(h.el('gestionImportsContent').innerHTML,/x@x/);
 h.ui.change({target:{dataset:{email:'x@x'},value:'102'}});h.context.response={previewId:'p2',preview:{groups:[],unresolvedEmails:[],blockers:[],canConfirm:true}};await h.ui.submit();assert.equal(h.calls[1].action,'splitPreview');assert.equal(h.calls[1].resultGroups['x@x'],'102');
 h.context.response={assignments:[]};await h.ui.submit();assert.equal(h.calls[2].action,'splitConfirm');assert.equal(h.calls[2].previewId,'p2');
});
test('old shared route requires an explicit live copy choice and does not navigate',async()=>{
 const h=harness();const choice=h.window.CardinalGestionImports.resolveOldWork({copies:[{assignmentId:'a',groupCode:'101'},{assignmentId:null,groupCode:'102'}]});
 await h.ui.submit();assert.equal(h.el('gestionImportsDialog').open,true);
 h.ui.change({target:{dataset:{copy:'1'},value:'a'}});await h.ui.submit();assert.equal(await choice,'a');assert.deepEqual(h.opened,[]);
});
test('incomplete metadata reads cannot prepare an import',async()=>{
 const h=harness();h.context.response={preview:{rows:[{activityId:'m',status:'missing',selectable:true,metadata:{}}]}};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,{...snapshot(),complete:false});await work;
 assert.equal(h.el('gestionImportsSubmit').disabled,true);await h.ui.submit();assert.equal(h.calls.length,1);assert.match(h.el('gestionImportsContent').innerHTML,/Liste Mozaïk incomplète/);
});
test('late server preview cannot populate a modal after navigation',async()=>{
 const h=harness();let resolve;h.context.api=(e,p)=>{h.calls.push(p);return new Promise(r=>resolve=r);};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,snapshot());await Promise.resolve();
 h.state.dashboardGroup='102';h.listeners['cardinal-group-changed']();
 resolve({previewId:'late',preview:{rows:[{title:'Late title',status:'missing',selectable:true}]}});await work;
 assert.equal(h.el('gestionImportsDialog').open,false);assert.doesNotMatch(h.el('gestionImportsContent').innerHTML,/Late title/);
});
test('escape cancellation releases an old-route resolver with null',async()=>{
 const h=harness();const result=h.window.CardinalGestionImports.resolveOldWork({copies:[{assignmentId:'a',groupCode:'101'}]});h.el('gestionImportsDialog').oncancel();assert.equal(await result,null);
});

test('uncertain metadata confirmation retries the same stored operation',async()=>{
 const h=harness();h.context.response={preview:{rows:[{activityId:'m',title:'Essai',status:'missing',selectable:true,metadata:{maxScore:10}}]}};
 const work=h.window.CardinalGestionImports.openMozaik();deliver(h,snapshot());await work;
 h.context.response={previewId:'stable',preview:{}};await h.ui.submit();
 h.context.api=async(e,p)=>{h.calls.push(p);throw Error('Connexion interrompue');};
 await h.ui.submit();await h.ui.submit();
 assert.equal(h.calls.at(-1).action,'mozaikConfirm');assert.equal(h.calls.at(-1).previewId,'stable');
 assert.equal(h.calls.at(-2).previewId,'stable');
});
