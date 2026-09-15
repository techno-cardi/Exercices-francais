importScripts('background-v091.js');

const SIMPLE_CONTEXT_KEY = 'cardinal_simple_formative_context_v092';
const MOZAIK_DISCOVERY_KEY = 'cardinal_mozaik_discovery_v092';
const SIMPLE_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

ensureFormativeUi = async function(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_FORMATIVE_UI', title:'Formative', message:'', status:'working' });
  } catch {
    try { await chrome.scripting.executeScript({ target:{ tabId }, files:['formative-simple-ui.js'] }); } catch {}
  }
};

function normalizePersonName092(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function nameKeys092(value) { const n=normalizePersonName092(value); if(!n)return[]; const p=n.split(' ').filter(Boolean),out=new Set([n]); if(p.length>=2)out.add([...p].reverse().join(' ')); return [...out]; }
function parseGrade092(value,maxScore){let raw=String(value??'').trim();if(!raw)return null;raw=raw.replace(',','.').replace(/\s+/g,'');const f=raw.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);if(f){const n=Number(f[1]),d=Number(f[2]);if(!Number.isFinite(n)||!Number.isFinite(d)||d<=0)return null;return{value:n*Number(maxScore)/d,sourceMax:d}}const p=raw.match(/^(-?\d+(?:\.\d+)?)%$/);if(p){const n=Number(p[1]);if(!Number.isFinite(n))return null;return{value:n*Number(maxScore)/100,sourceMax:100}}const n=Number(raw);return Number.isFinite(n)?{value:n,sourceMax:Number(maxScore)}:null}

async function getSimpleContext092(){const o=await chrome.storage.local.get(SIMPLE_CONTEXT_KEY);const ctx=o?.[SIMPLE_CONTEXT_KEY]||null;if(!ctx||!ctx.createdAt||Date.now()-Number(ctx.createdAt)>SIMPLE_CONTEXT_TTL_MS){await chrome.storage.local.remove(SIMPLE_CONTEXT_KEY);return null}return ctx}
async function saveSimpleContext092(ctx){await chrome.storage.local.set({[SIMPLE_CONTEXT_KEY]:{...ctx,createdAt:Date.now()}})}

function mapChatGptRows092(ctx,rows){
  const question=ctx?.question,answers=Array.isArray(question?.answers)?question.answers:[],maxScore=Number(question?.possiblePoints||0),index=new Map();
  for(const a of answers)for(const key of nameKeys092(a.studentName)){if(!index.has(key))index.set(key,[]);index.get(key).push(a)}
  const mapped=[],unmatched=[],ambiguous=[],invalid=[],seenAnswerIds=new Set();
  for(const row of Array.isArray(rows)?rows:[]){
    const name=String(row?.name||row?.student||row?.eleve||'').trim();if(!name)continue;const candidates=new Map();for(const key of nameKeys092(name))for(const a of index.get(key)||[])candidates.set(String(a.answerId),a);const list=[...candidates.values()];
    if(!list.length){unmatched.push(name);continue}if(list.length!==1){ambiguous.push(name);continue}const a=list[0];if(seenAnswerIds.has(String(a.answerId))){ambiguous.push(name);continue}
    const parsed=parseGrade092(row?.grade??row?.note??'',maxScore),hasGrade=parsed!==null,comment=String(row?.comment??row?.feedback??row?.commentaire??'').trim();if(!hasGrade&&!comment){invalid.push(`${name} : aucune note ni commentaire`);continue}
    let grade=null;if(hasGrade){grade=Math.round((Number(parsed.value)+Number.EPSILON)*1000)/1000;if(!Number.isFinite(grade)||grade<0||grade>maxScore+1e-9){invalid.push(`${name} : note invalide (${String(row?.grade??row?.note??'')})`);continue}}
    seenAnswerIds.add(String(a.answerId));mapped.push({answerId:String(a.answerId),questionId:String(a.formativeItemId||question.id),formativeItemId:String(a.formativeItemId||question.id),studentId:String(a.studentId||''),studentName:String(a.studentName||name),studentEmail:String(a.studentEmail||''),questionNumber:String(question.number||''),questionLabel:String(question.text||''),possiblePoints:maxScore,originalPoints:a.currentPoints===null||a.currentPoints===undefined?null:Number(a.currentPoints),points:hasGrade?grade:null,comment,fingerprint:String(a.fingerprint||''),publishNote:hasGrade,publishComment:!!comment});
  }
  return{mapped,unmatched,ambiguous,invalid,maxScore};
}

async function focusOrOpenChatGpt092(){const tabs=await chrome.tabs.query({url:['https://chatgpt.com/*','https://chat.openai.com/*']});let tab=[...tabs].sort((a,b)=>Number(b.lastAccessed||0)-Number(a.lastAccessed||0))[0];if(tab?.id){try{await chrome.windows.update(tab.windowId,{focused:true})}catch{}try{await chrome.tabs.update(tab.id,{active:true})}catch{}return tab}return chrome.tabs.create({url:'https://chatgpt.com/',active:true})}

async function deliverSimplePreview092(payload){
  const ctx=await getSimpleContext092();if(!ctx)throw new Error('La question Formative n’est plus en mémoire. Retourne dans Formative et clique de nouveau sur « Corriger avec ChatGPT ».');const parsed=mapChatGptRows092(ctx,payload?.rows||[]);if(!parsed.mapped.length){const detail=[...parsed.unmatched,...parsed.ambiguous,...parsed.invalid].slice(0,8).join(', ');throw new Error(`Aucun résultat n’a pu être associé à la question Formative${detail?` : ${detail}`:'.'}`)}
  const preview={context:{formativeId:ctx.formativeId,assignmentId:ctx.assignmentId,sectionId:ctx.sectionId,sectionTitle:ctx.sectionTitle,groupCode:ctx.groupCode,title:ctx.title,sessionId:ctx.sessionId,question:{id:ctx.question.id,number:ctx.question.number,text:ctx.question.text,possiblePoints:ctx.question.possiblePoints}},rows:parsed.mapped,unmatched:parsed.unmatched,ambiguous:parsed.ambiguous,invalid:parsed.invalid,source:String(payload?.source||'ChatGPT')};
  await chrome.storage.local.set({cardinal_simple_pending_preview_v092:preview});const tab=await focusOrOpenFormative(String(ctx.formativeId||''));await ensureFormativeUi(tab.id);try{await chrome.tabs.sendMessage(tab.id,{type:'CARDINAL_SIMPLE_IMPORT_PREVIEW',preview})}catch{await ensureFormativeUi(tab.id);await sleepFormative(150);await chrome.tabs.sendMessage(tab.id,{type:'CARDINAL_SIMPLE_IMPORT_PREVIEW',preview}).catch(()=>{})}return{ok:true,recognized:parsed.mapped.length,unmatched:parsed.unmatched.length,ambiguous:parsed.ambiguous.length,invalid:parsed.invalid.length};
}

function academicYearKey092(){const d=new Date(),start=d.getMonth()>=6?d.getFullYear():d.getFullYear()-1;return`${start}-${start+1}`}
function parseMozaikDiscoveryUrl092(url){const u=String(url||''),out=[];let m;if((m=u.match(/\/api\/evaluation\/planifications\/(\d+)\/groupes\/([^/?#]+)/i)))out.push({establishmentId:m[1],id:decodeURIComponent(m[2]),kind:'course'});if((m=u.match(/\/api\/organisationscolaire\/groupes\/(\d+)\/([^/?#]+)\/membres/i)))out.push({establishmentId:m[1],id:decodeURIComponent(m[2]),kind:'matter'});if((m=u.match(/\/api\/evaluation\/apprentissage\/(\d+)\/activites\/groupe\/([^/?#]+)/i))){const id=decodeURIComponent(m[2]);out.push({establishmentId:m[1],id,kind:/\d{4}M\d+-[^/]+$/i.test(id)?'matter':'course'})}if((m=u.match(/\/api\/evaluation\/resultats\/(\d+)\/[^?#]*?\/groupe\/([^/?#]+)/i)))out.push({establishmentId:m[1],id:decodeURIComponent(m[2]),kind:'matter'});if((m=u.match(/^https:\/\/mozaikportail\.ca\/(\d+)\/groupes\/([^/?#]+)/i)))out.push({establishmentId:m[1],id:decodeURIComponent(m[2]),kind:'course'});return out}
async function rememberDiscoveryUrl092(url){const items=parseMozaikDiscoveryUrl092(url);if(!items.length)return;const o=await chrome.storage.local.get(MOZAIK_DISCOVERY_KEY),root=o?.[MOZAIK_DISCOVERY_KEY]||{},year=academicYearKey092();root[year]=root[year]||{seen:[],updatedAt:0};const seen=new Map((root[year].seen||[]).map(x=>[`${x.kind}|${x.establishmentId}|${x.id}`,x]));for(const item of items)seen.set(`${item.kind}|${item.establishmentId}|${item.id}`,{...item,at:Date.now()});root[year].seen=[...seen.values()].slice(-400);root[year].updatedAt=Date.now();await chrome.storage.local.set({[MOZAIK_DISCOVERY_KEY]:root})}
try{chrome.webRequest.onCompleted.addListener(details=>{rememberDiscoveryUrl092(details.url).catch(()=>{})},{urls:['https://mozaikportail.ca/*','https://apiaffaires.mozaikportail.ca/*']})}catch{}
async function scanMozaikPage092(tabId){const rr=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>{const urls=new Set([location.href]);try{document.querySelectorAll('a[href]').forEach(a=>urls.add(a.href))}catch{}try{performance.getEntriesByType('resource').forEach(e=>e?.name&&urls.add(e.name))}catch{}return[...urls]}});const urls=Array.isArray(rr?.[0]?.result)?rr[0].result:[];for(const u of urls)await rememberDiscoveryUrl092(u);return urls}
function groupCodeFromMozaikId092(id){const m=String(id||'').match(/-([A-Za-z0-9]+)$/);return m?m[1]:''}
function subjectCodeFromMatterId092(id){const m=String(id||'').match(/M(\d+)-[A-Za-z0-9]+$/i);return m?m[1]:''}
async function getDiscoveryCandidates092(groupCode){const o=await chrome.storage.local.get(MOZAIK_DISCOVERY_KEY),root=o?.[MOZAIK_DISCOVERY_KEY]||{},bucket=root[academicYearKey092()]||{seen:[]};return(bucket.seen||[]).filter(x=>groupCodeFromMozaikId092(x.id)===String(groupCode))}
function chooseDiscovery092(candidates,groupCode){const yearStart=Number(academicYearKey092().split('-')[0]||0),currentYearId=x=>!yearStart||String(x?.id||'').includes(String(yearStart));let course=candidates.filter(x=>x.kind==='course'),matter=candidates.filter(x=>x.kind==='matter');const currentCourse=course.filter(currentYearId),currentMatter=matter.filter(currentYearId);if(currentCourse.length)course=currentCourse;if(currentMatter.length)matter=currentMatter;const coursePreferred=course.find(x=>/CFRA/i.test(x.id))||course[course.length-1]||null;let matterPreferred=null;if(coursePreferred)matterPreferred=matter.filter(x=>x.establishmentId===coursePreferred.establishmentId).slice(-1)[0]||null;matterPreferred=matterPreferred||matter[matter.length-1]||null;const establishmentId=String(coursePreferred?.establishmentId||matterPreferred?.establishmentId||'');if(!coursePreferred||!matterPreferred||!establishmentId)return null;const subjectCode=subjectCodeFromMatterId092(matterPreferred.id);if(!subjectCode)return null;return{code:String(groupCode),establishmentId,groupCourseId:String(coursePreferred.id),groupMatterId:String(matterPreferred.id),subjectCode}}

async function discoverMozaikGroup092(groupCode,force=false){
  const code=String(groupCode||'').trim();if(!code)throw new Error('Groupe manquant.');let candidates=await getDiscoveryCandidates092(code),chosen=chooseDiscovery092(candidates,code);const hadCachedGroup=!!chosen;let tab=await focusOrOpenMozaik({waitComplete:true});tab=await waitForAuthenticatedMozaikTab(tab.id,180000);await scanMozaikPage092(tab.id).catch(()=>{});candidates=await getDiscoveryCandidates092(code);chosen=chooseDiscovery092(candidates,code);
  if(!chosen){const yearStart=Number(academicYearKey092().split('-')[0]||0);let courseCandidates=candidates.filter(x=>x.kind==='course');const currentCourses=courseCandidates.filter(x=>!yearStart||String(x.id||'').includes(String(yearStart)));if(currentCourses.length)courseCandidates=currentCourses;const c=courseCandidates.find(x=>/CFRA/i.test(x.id))||courseCandidates.slice(-1)[0];if(c?.establishmentId&&c?.id){const rosterUrl=`https://mozaikportail.ca/${c.establishmentId}/groupes/${c.id}/eleves/liste`;try{await chrome.tabs.update(tab.id,{url:rosterUrl,active:true});await waitForTabComplete(tab.id,45000);await sleep(1800);await scanMozaikPage092(tab.id)}catch{}candidates=await getDiscoveryCandidates092(code);chosen=chooseDiscovery092(candidates,code)}}
  if(!chosen)return{ok:false,message:`Je n’ai pas encore pu détecter automatiquement les deux identifiants Mozaïk du groupe ${code}. Ouvre une fois la liste des élèves de ce groupe dans Mozaïk, puis réessaie.`,candidates};let roster=[];try{const rr=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:extractOfficialRoster,args:[chosen]});roster=Array.isArray(rr?.[0]?.result)?rr[0].result:[]}catch{}return{ok:true,group:chosen,roster,source:hadCachedGroup&&!force?'cache+live-roster':'live'};
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==='CARDINAL_SAVE_SIMPLE_CONTEXT'){(async()=>{try{await saveSimpleContext092(message.context||{});sendResponse({ok:true})}catch(error){sendResponse({ok:false,message:error?.message||String(error)})}})();return true}
  if(message?.type==='CARDINAL_GET_SIMPLE_CONTEXT'){(async()=>{try{sendResponse({ok:true,context:await getSimpleContext092()})}catch(error){sendResponse({ok:false,message:error?.message||String(error)})}})();return true}
  if(message?.type==='CARDINAL_OPEN_CHATGPT'){(async()=>{try{const tab=await focusOrOpenChatGpt092();sendResponse({ok:!!tab?.id})}catch(error){sendResponse({ok:false,message:error?.message||String(error)})}})();return true}
  if(message?.type==='CARDINAL_CHATGPT_RESULTS'){(async()=>{try{sendResponse(await deliverSimplePreview092(message.payload||{}))}catch(error){sendResponse({ok:false,message:error?.message||String(error)})}})();return true}
  if(message?.type==='DISCOVER_MOZAIK_GROUP'){(async()=>{try{sendResponse(await discoverMozaikGroup092(message.groupCode,message.force===true))}catch(error){sendResponse({ok:false,message:error?.message||String(error)})}})();return true}
});

const handleFormativeRequestV091_092=handleFormativeRequest;
handleFormativeRequest=async function(action,payload){
  if(action==='sendGlobalToGestionV3'){
    const formativeId=String(payload?.formativeId||'');if(!formativeId)throw new Error('Formative manquant.');let tab=await focusOrOpenFormative(formativeId);tab=await ensureFormativeSession091(tab);const tracked=formativeHeadersByTab.get(tab.id)||{};await sendFormativeUi(tab.id,{title:'Résultat global',message:'Je relis toutes les questions et tous les résultats de cette classe…',status:'working'});const rr=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:formativeSnapshotForSection091InsidePage,args:[formativeId,String(payload?.assignmentId||''),String(payload?.sectionId||''),tracked]});const snapshot=rr?.[0]?.result;if(!snapshot?.formativeId)throw new Error('Impossible de relire les résultats de cette classe.');snapshot.globalImport=true;snapshot.importIntent='global_evaluation_result';await deliverFormativeImport(snapshot);return{ok:true,studentCount:snapshot.students?.length||0,questionCount:snapshot.questions?.length||0,groupCode:snapshot.groupCode};
  }
  return handleFormativeRequestV091_092(action,payload);
};
