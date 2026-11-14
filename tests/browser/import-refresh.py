"""Run the actual import UIs with a synthetic API, no student data or external network."""
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
app=(ROOT/'resultats/app.js').read_text()
refresh=app[app.index('async function refreshTeacherData('):app.index('async function loadTeacherDashboard(')]
render=app[app.index('function renderDashboard('):app.index('["assignmentSearch", "assignmentCompetenceFilter"]')]
html=(ROOT/'resultats/index.html').read_text()
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
html=re.sub(r'<link\b[^>]*>','',html)
fixture=r'''
for(const key of ['localStorage','sessionStorage']){const values=new Map();Object.defineProperty(window,key,{value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}})}
let testRequest=0;crypto.randomUUID=()=> 'fixture-request-'+(++testRequest);
const nativePost=window.postMessage.bind(window);window.postMessage=(message,target)=>nativePost(message,target==='null'?'*':target);
window.state={teacherToken:'fixture-token',schoolYear:2026,schoolYearRevision:1,teacherDataYear:2026,navigationRevision:1,teacherAssignments:[],groupStats:{'32':1},dashboardGroup:'32',detailGroup:'32',dashboardTerm:'1',extensionReady:true,extensionVersion:'1.3.54'};
window.$=id=>document.getElementById(id);window.TEACHER_ENDPOINT='fixture';
window.today=()=> '2026-11-13';window.formatNumber=String;window.formatGradePercent=()=>'';window.competencyArray=()=>[1];window.competenceLabel=()=> 'Lire';window.fillWorkPage=()=>{};
window.dashboardGroups=()=>['32'];window.activeAssignmentGroups=()=>['32'];window.actions=[];window.catalogue=[];window.notifications=[];window.failRead=false;window.opened=[];
window.notify=(...v)=>notifications.push(v);window.openAssignment=async id=>{opened.push(id);return true};
window.setInterval=()=>0;
window.api=async(endpoint,p)=>{actions.push(p.action);
 if(p.action==='teacherDashboard'){if(failRead)throw Error('Lecture indisponible (test)');return {assignments:catalogue,groups:{'32':1},context:{year:2026,isActive:true,readOnly:false}};}
 if(p.action==='formativePreview')return {ok:true,previewId:'formative-fixture',preview:{rows:[],counts:{},sourceMaxScore:10,targetMaxScore:10}};
 if(p.action==='mozaikPreview')return {previewId:'metadata-fixture',preview:{links:[],rows:[{activityId:'native-fixture',title:'Travail fictif importé',status:'missing',selectable:true,metadata:{maxScore:10}}]}};
 if(p.action==='formativeConfirm'||p.action==='mozaikConfirm'){
   catalogue=[{id:'new-fixture',title:'Travail fictif importé',groups:['32'],term:1,competenceKind:'lecture',weight:10,maxScore:10,gradedCount:1,studentCount:1,average:8}];
   return {ok:true,assignmentId:'new-fixture',importedCount:1,assignments:[{id:'new-fixture',groupCode:'32'}]};
 }throw Error('Unexpected action: '+p.action);
};
window.addEventListener('message',event=>{if(event.data?.type==='MOZAIK_EXTENSION_PLANNED_ACTIVITIES')window.postMessage({source:'cardinal-mozaik-extension',type:'MOZAIK_EXTENSION_PLANNED_ACTIVITIES_RESULT',requestId:event.data.requestId,result:{ok:true,complete:true,scope:{groupCode:'32',schoolYear:'2026',schoolId:'fixture',subjectId:'FR',mozaikGroupId:'fixture'},activities:[]}},location.origin)});
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 results=[]
 for source in ['mozaik','formative']:
  for failed in [False,True]:
   page=browser.new_page();page.set_default_timeout(5000);network=[];errors=[]
   page.route('**/*',lambda r:(network.append(r.request.url),r.abort()))
   page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html)
   page.add_script_tag(content=fixture);page.add_script_tag(content=app[app.index('function esc('):app.index('function formatNumber(')]+refresh+render)
   if source=='formative':
    s=(ROOT/'resultats/formative-integration.js').read_text();s=re.sub(r'\}\)\(\);\s*$', 'window.fixtureImport={showImportModal};})();',s)
    page.add_script_tag(content=s)
    page.evaluate("fixtureImport.showImportModal({formativeId:'fixture',groupCode:'32',title:'Travail fictif importé',hierarchy:[{id:'q1',parentId:null}],questions:[{id:'q1',label:'Question fictive',possiblePoints:10,gradedCount:1}],students:[]})")
    button='#confirmFormativeImport';dialog='#formativeImportDialog'
   else:
    page.add_script_tag(content=(ROOT/'resultats/gestion-imports.js').read_text())
    page.evaluate('void CardinalGestionImports.openMozaik()');button='#gestionImportsSubmit';dialog='#gestionImportsDialog'
   page.locator(dialog+'[open]').wait_for()
   try:page.wait_for_function(f"!document.querySelector('{button}').disabled")
   except Exception:
    print('DIAGNOSTIC',source,errors,page.evaluate('({actions,notifications,origin:location.origin,text:document.querySelector("dialog[open]").innerText})'));raise
   # Mozaik first catalogue preview already supplies a previewId in the fake API,
   # but the UI stores it only after the explicit prepare click.
   page.locator(button).click();page.wait_for_function(f"document.querySelector('{button}').textContent.includes('Confirmer') && !document.querySelector('{button}').disabled")
   page.evaluate('failRead='+str(failed).lower());page.locator(button).click()
   if failed:
    page.wait_for_function(f"document.querySelector('{button}').textContent.includes('Actualiser')")
    page.evaluate('failRead=false');page.locator(button).click()
   try:page.wait_for_function(f"!document.querySelector('{dialog}').open")
   except Exception:
    print("CLOSE DIAGNOSTIC",source,failed,errors,page.evaluate('({actions,notifications,text:document.querySelector("dialog[open]").innerText})'));raise
   assert 'Travail fictif importé' in page.locator('#assignmentList').inner_text()
   assert 'Travail fictif importé' in page.locator('#recentAssignments').inner_text()
   writes=page.evaluate("actions.filter(x=>x.endsWith('Confirm'))")
   assert writes==[source+'Confirm'],writes
   assert not errors,errors
   assert not network,network
   if source=='formative':assert page.evaluate('opened')==['new-fixture']
   results.append({'source':source,'readFailureThenRetry':failed,'visibleWithoutReload':True,'confirmationCount':len(writes),'networkRequests':len(network),'pageErrors':len(errors)})
   page.close()
 browser.close()
 print(json.dumps({'passed':len(results),'scenarios':results},ensure_ascii=False,indent=2))
