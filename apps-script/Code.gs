const TABS = { users:'Utilisateurs', groups:'Groupes', assignments:'Affectations', results:'Résultats', responses:'Réponses', answers:'Corrigés', live:'En direct' };

function doPost(event) {
  try {
    const request = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    const publicActions = { loginWithEmail: loginWithEmail_, verifyTeacherPassword: verifyTeacherPassword_ };
    const privateActions = { bootstrap: bootstrap_, dashboard: dashboard_, studentCopy: studentCopy_, saveGroup: saveGroup_, importUsers: importUsers_, saveAssignment: saveAssignment_, saveDraft: saveDraft_, grade: grade_ };
    let result;
    if (publicActions[request.action]) result = publicActions[request.action](request);
    else if (privateActions[request.action]) result = privateActions[request.action](request, requireSession_(request.token));
    else throw appError_('Demande inconnue.', 'BAD_REQUEST');
    return json_({ ok:true, ...result });
  } catch (error) {
    return json_({ ok:false, code:error.code || 'ERROR', message:error.message || 'Une erreur est survenue.' });
  }
}

function loginWithEmail_(request) {
  const email=normalizeEmail_(request.email); if(!email)throw appError_('Entre une adresse courriel valide.','BAD_EMAIL');
  const user=findUser_(email); if(!user||!isTrue_(user.actif))throw appError_('Cette adresse ne fait pas partie des groupes autorisés.','FORBIDDEN');
  if(user.role==='enseignant')return {needsPassword:true,setupRequired:!PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD_HASH')};
  touchLastLogin_(email);
  const session={email,name:user.nom||email,role:'eleve',groups:splitList_(user.groupes),exp:Date.now()+8*60*60*1000};
  return {token:signToken_(session),user:session};
}

function verifyTeacherPassword_(request) {
  const email=normalizeEmail_(request.email),user=findUser_(email),password=String(request.password||'');
  if(!user||!isTrue_(user.actif)||user.role!=='enseignant')throw appError_('Le courriel ou le mot de passe est incorrect.','FORBIDDEN');
  const properties=PropertiesService.getScriptProperties();
  let saved=properties.getProperty('TEACHER_PASSWORD_HASH')||'';
  if(!saved){
    const lock=LockService.getScriptLock();lock.waitLock(10000);
    try{
      saved=properties.getProperty('TEACHER_PASSWORD_HASH')||'';
      if(!saved){
        const setupCode=properties.getProperty('TEACHER_SETUP_CODE')||'';
        if(!setupCode||String(request.setupCode||'')!==setupCode)throw appError_('Le code temporaire est invalide.','FORBIDDEN');
        if(password.length<10)throw appError_('Choisis un mot de passe d’au moins 10 caractères.','BAD_PASSWORD');
        saved=digest_(password);properties.setProperty('TEACHER_PASSWORD_HASH',saved);properties.deleteProperty('TEACHER_SETUP_CODE');
      }
    }finally{lock.releaseLock();}
  }
  if(digest_(password)!==saved)throw appError_('Le courriel ou le mot de passe est incorrect.','FORBIDDEN');
  const session={email,name:user.nom||email,role:'enseignant',groups:splitList_(user.groupes),exp:Date.now()+8*60*60*1000};return {token:signToken_(session),user:session};
}

function bootstrap_(request, session) {
  const assignments = readObjects_(TABS.assignments).filter(item => isTrue_(item.actif));
  if (session.role === 'enseignant') {
    ensureLiveSheet_();
    const students=readObjects_(TABS.users).filter(user=>user.role==='eleve'&&isTrue_(user.actif));
    const groups = readObjects_(TABS.groups).filter(item => isTrue_(item.actif)).map(group => {
      const members=students.filter(user=>splitList_(user.groupes).includes(String(group.code))).map(user=>({email:user.courriel,name:user.nom||user.courriel,lastLogin:user.derniereConnexion||''})).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
      return { code:String(group.code), name:group.nom, students:members.length, members };
    });
    const dashboard=dashboardData_();
    return { user:session, groups, assignments:assignments.map(publicAssignment_), results:dashboard.results, progress:dashboard.progress, updatedAt:dashboard.updatedAt, sheetUrl:spreadsheet_().getUrl() };
  }
  const studentResults=readObjects_(TABS.results).filter(item=>item.courriel===session.email); 
  const visible = assignments.filter(item => intersects_(splitList_(item.groupes), session.groups) && isOpen_(item)).map(item=>{const output=publicAssignment_(item);output.completed=new Set(studentResults.filter(row=>String(row.affectationId)===String(item.id)).map(row=>String(row.exerciceId))).size;return output;});
  return { user:session, assignments:visible };
}

function dashboard_(request, session) { requireTeacher_(session); return dashboardData_(); }

function studentCopy_(request, session) {
  requireTeacher_(session); const email=normalizeEmail_(request.email),assignmentId=String(request.assignmentId||'');
  const assignment=readObjects_(TABS.assignments).find(item=>String(item.id)===assignmentId);if(!email||!assignment)throw appError_('Cette copie est introuvable.','NOT_FOUND');
  const results=readObjects_(TABS.results).filter(row=>row.courriel===email&&String(row.affectationId)===assignmentId);const latest={};
  results.forEach(row=>{const key=String(row.exerciceId),time=new Date(row.horodatage).getTime()||0;if(!latest[key]||(new Date(latest[key].horodatage).getTime()||0)<=time)latest[key]=row;});
  const responses=readObjects_(TABS.responses),copies={};
  Object.values(latest).forEach(row=>{const answers={},details={};responses.filter(item=>String(item.remiseId)===String(row.remiseId)).forEach(item=>{try{answers[item.elementId]=JSON.parse(item.reponse);}catch{answers[item.elementId]=item.reponse;}details[item.elementId]=isTrue_(item.reussi);});copies[String(row.exerciceId)]={remiseId:row.remiseId,timestamp:row.horodatage,matrixId:String(row.matriceId),exerciseId:String(row.exerciceId),exerciseLabel:row.exercice,score:Number(row.score)||0,total:Number(row.total)||0,percentage:Number(row.pourcentage)||0,attempt:Number(row.tentative)||1,answers,details,status:'corrige'};});
  ensureLiveSheet_();readObjects_(TABS.live).filter(row=>row.courriel===email&&String(row.affectationId)===assignmentId&&row.etat!=='remis').forEach(row=>{const key=String(row.exerciceId),current=copies[key],draftTime=new Date(row.horodatage).getTime()||0,copyTime=current?(new Date(current.timestamp).getTime()||0):0;if(draftTime<copyTime)return;let answers={};try{answers=JSON.parse(row.reponsesJson||'{}');}catch{}copies[key]={remiseId:'',timestamp:row.horodatage,matrixId:String(row.matriceId),exerciseId:key,exerciseLabel:row.exercice,score:0,total:Number(row.reponsesTotal)||0,percentage:0,attempt:0,answers,details:{},status:'en_cours',answered:Number(row.reponsesDonnees)||0};});
  const remises=Object.values(copies).sort((a,b)=>(new Date(a.timestamp).getTime()||0)-(new Date(b.timestamp).getTime()||0));
  const user=findUser_(email);return {student:{email,name:(user&&user.nom)||email,groups:splitList_(user&&user.groupes)},assignment:publicAssignment_(assignment),remises};
}

function dashboardData_() {
  const rows=readObjects_(TABS.results); const latest={};
  rows.forEach(row=>{const key=[row.courriel,row.affectationId,row.exerciceId].join('|');const time=new Date(row.horodatage).getTime()||0;if(!latest[key]||(new Date(latest[key].horodatage).getTime()||0)<=time)latest[key]=row;});
  const combined={};Object.values(latest).forEach(row=>{const key=[row.courriel,row.affectationId,row.exerciceId].join('|');combined[key]={timestamp:row.horodatage,email:row.courriel,name:row.nom||row.courriel,groups:splitList_(row.groupes),assignmentId:String(row.affectationId),assignmentTitle:row.titre,exerciseId:String(row.exerciceId),matrixId:String(row.matriceId),exerciseLabel:row.exercice||('Exercice '+row.exerciceId),score:Number(row.score)||0,total:Number(row.total)||0,percentage:Number(row.pourcentage)||0,attempt:Number(row.tentative)||1,status:'corrige',answered:Number(row.total)||0};});
  ensureLiveSheet_();const live=readObjects_(TABS.live).filter(row=>row.etat!=='remis');live.forEach(row=>{const key=[row.courriel,row.affectationId,row.exerciceId].join('|'),existing=combined[key],time=new Date(row.horodatage).getTime()||0,existingTime=existing?(new Date(existing.timestamp).getTime()||0):0;if(time<existingTime)return;combined[key]={timestamp:row.horodatage,email:row.courriel,name:row.nom||row.courriel,groups:splitList_(row.groupes),assignmentId:String(row.affectationId),assignmentTitle:row.titre,exerciseId:String(row.exerciceId),matrixId:String(row.matriceId),exerciseLabel:row.exercice||('Exercice '+row.exerciceId),score:0,total:Number(row.reponsesTotal)||0,percentage:0,attempt:0,status:'en_cours',answered:Number(row.reponsesDonnees)||0};});
  const progress=Object.values(combined).sort((a,b)=>(new Date(b.timestamp).getTime()||0)-(new Date(a.timestamp).getTime()||0));
  const scores=Object.values(latest).map(row=>Number(row.pourcentage)).filter(Number.isFinite),recent=Date.now()-10*60*1000;
  return { results:{ remises:rows.length, average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0, activeStudents:new Set(rows.map(row=>row.courriel)).size, activeNow:new Set(live.filter(row=>(new Date(row.horodatage).getTime()||0)>=recent).map(row=>row.courriel)).size, inProgress:live.length }, progress, updatedAt:new Date().toISOString() };
}

function saveGroup_(request, session) {
  requireTeacher_(session); const group=request.group || {}; const code=String(group.code || '').trim(); const name=String(group.name || '').trim();
  if (!code || !name) throw appError_('Le code et le nom sont requis.', 'BAD_GROUP');
  upsert_(TABS.groups, 'code', code, { code, nom:name, actif:true }); return { message:'Le groupe est enregistré.' };
}

function importUsers_(request, session) {
  requireTeacher_(session); const groupCode=String(request.groupCode || '').trim(); const role=request.role === 'enseignant' ? 'enseignant' : 'eleve';
  const emails=[...new Set((request.emails || []).map(normalizeEmail_).filter(Boolean))];
  emails.forEach(email => { const current=findUser_(email); const groups=new Set(splitList_(current && current.groupes)); if(groupCode)groups.add(groupCode); upsert_(TABS.users,'courriel',email,{ courriel:email, nom:(current&&current.nom)||'', role, groupes:[...groups].join(','), actif:true, creeLe:(current&&current.creeLe)||new Date(), derniereConnexion:(current&&current.derniereConnexion)||'' }); });
  return { message:emails.length + ' adresse' + (emails.length > 1 ? 's ont' : ' a') + ' été ajoutée' + (emails.length > 1 ? 's.' : '.') };
}

function saveAssignment_(request, session) {
  requireTeacher_(session); const item=request.assignment || {}; const title=String(item.title || '').trim(); const matrixIds=(item.matrixIds || []).map(String);
  if (!title || !matrixIds.length || !(item.groupCodes || []).length) throw appError_('Ajoute un titre, un groupe et au moins une notion.', 'BAD_ASSIGNMENT');
  const id=item.id || Utilities.getUuid(); const row={ id, titre:title, mode:item.mode === 'evaluation' ? 'evaluation' : 'formatif', groupes:(item.groupCodes || []).join(','), matrices:matrixIds.join(','), exercices:(item.exerciseIds || []).join(','), debut:item.startAt || '', echeance:item.dueAt || '', tentatives:Math.max(1,Number(item.attempts)||1), retroaction:item.feedback !== false, actif:true, creePar:session.email, creeLe:new Date() };
  upsert_(TABS.assignments,'id',id,row); return { message:'L’activité est assignée.' };
}

function saveDraft_(request, session) {
  if(session.role!=='eleve')throw appError_('Cette sauvegarde est réservée aux élèves.','FORBIDDEN');
  const assignment=readObjects_(TABS.assignments).find(item=>String(item.id)===String(request.assignmentId));
  if(!assignment||!isTrue_(assignment.actif)||!intersects_(splitList_(assignment.groupes),session.groups)||!isOpen_(assignment))throw appError_('Cette activité n’est pas accessible.','FORBIDDEN');
  const matrixId=String(request.matrixId||''),exerciseId=String(request.exerciseId||''),matrices=splitList_(assignment.matrices),explicit=splitList_(assignment.exercices);
  if(!matrices.includes(matrixId)||(explicit.length&&!explicit.includes(exerciseId)))throw appError_('Exercice non autorisé.','FORBIDDEN');
  const answers=request.answers&&typeof request.answers==='object'?request.answers:{},serialized=JSON.stringify(answers);if(serialized.length>100000)throw appError_('La réponse est trop volumineuse.','BAD_REQUEST');
  const answered=Object.keys(answers).filter(key=>hasAnswer_(answers[key])).length,total=Math.max(answered,Number(request.total)||0),now=new Date(),key=[session.email,assignment.id,exerciseId].join('|');
  ensureLiveSheet_();withScriptLock_(()=>upsert_(TABS.live,'cle',key,{cle:key,horodatage:now,courriel:session.email,nom:session.name,groupes:session.groups.join(','),affectationId:assignment.id,titre:assignment.titre,matriceId:matrixId,exerciceId:exerciseId,exercice:String(request.exerciseLabel||('Exercice '+exerciseId)),reponsesJson:serialized,reponsesDonnees:answered,reponsesTotal:total,etat:'en cours'}));
  return {savedAt:now.toISOString(),answered,total};
}

function grade_(request, session) {
  const assignment=readObjects_(TABS.assignments).find(item=>String(item.id)===String(request.assignmentId));
  if (!assignment || !isTrue_(assignment.actif) || (session.role !== 'enseignant' && (!intersects_(splitList_(assignment.groupes),session.groups) || !isOpen_(assignment)))) throw appError_('Cette activité n’est pas accessible.', 'FORBIDDEN');
  const exerciseId=String(request.exerciseId || ''); const matrices=splitList_(assignment.matrices); if(!matrices.includes(String(request.matrixId)))throw appError_('Exercice non autorisé.','FORBIDDEN');
  const explicit=splitList_(assignment.exercices); if(explicit.length && !explicit.includes(exerciseId))throw appError_('Exercice non autorisé.','FORBIDDEN');
  const answerRow=readObjects_(TABS.answers).find(item=>String(item.exerciceId)===exerciseId); if(!answerRow)throw appError_('La correction de cet exercice est indisponible.','NO_ANSWER');
  const prior=readObjects_(TABS.results).filter(item=>item.courriel===session.email && String(item.affectationId)===String(assignment.id) && String(item.exerciceId)===exerciseId).length;
  if(prior >= Number(assignment.tentatives || 1))throw appError_('Tu as utilisé toutes tes tentatives.','NO_ATTEMPTS');
  const key=JSON.parse(answerRow.reponsesJson || '[]'); const submitted=request.answers || {}; const details=key.map(item=>({ id:item.id, correct:answerMatches_(submitted[item.id],item) }));
  const score=details.filter(item=>item.correct).length,total=details.length,percentage=total?Math.round(score/total*100):0,remiseId=Utilities.getUuid(),now=new Date();
  appendObject_(TABS.results,{ horodatage:now, remiseId, courriel:session.email, nom:session.name, groupes:session.groups.join(','), affectationId:assignment.id, titre:assignment.titre, mode:assignment.mode, exercice:String(request.exerciseLabel||('Exercice '+exerciseId)), exerciceId:exerciseId, matriceId:request.matrixId, score, total, pourcentage:percentage, tentative:prior+1 });
  details.forEach(detail=>appendObject_(TABS.responses,{ horodatage:now, remiseId, courriel:session.email, affectationId:assignment.id, exerciceId:exerciseId, elementId:detail.id, reponse:JSON.stringify(submitted[detail.id] ?? null), reussi:detail.correct }));
  ensureLiveSheet_();const liveKey=[session.email,assignment.id,exerciseId].join('|');withScriptLock_(()=>upsert_(TABS.live,'cle',liveKey,{cle:liveKey,horodatage:now,courriel:session.email,nom:session.name,groupes:session.groups.join(','),affectationId:assignment.id,titre:assignment.titre,matriceId:String(request.matrixId),exerciceId:exerciseId,exercice:String(request.exerciseLabel||('Exercice '+exerciseId)),reponsesJson:JSON.stringify(submitted),reponsesDonnees:Object.keys(submitted).filter(key=>hasAnswer_(submitted[key])).length,reponsesTotal:total,etat:'remis'}));
  const show=assignment.mode === 'formatif' && isTrue_(assignment.retroaction); return { score,total,percentage,details:show?details:[],message:assignment.mode === 'evaluation'?'Tes réponses sont enregistrées.':show?(score===total?'Bravo! Tout est réussi.':'Regarde les réponses indiquées et essaie le prochain exercice.'):'Tes réponses sont enregistrées.' };
}

function answerMatches_(actual, item) {
  const expected=item.expected; if(typeof expected === 'boolean')return Boolean(actual)===expected;
  const normalize=value=>{let text=String(value ?? '').trim().replace(/\s+/g,' ');return item.caseSensitive?text:text.toLocaleLowerCase('fr-CA');};
  if(Array.isArray(actual)){const a=actual.map(normalize).sort(),e=(Array.isArray(expected)?expected:[expected]).map(normalize).sort();return JSON.stringify(a)===JSON.stringify(e);}
  return (Array.isArray(expected)?expected:[expected]).map(normalize).includes(normalize(actual));
}

function hasAnswer_(value){return value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length>0);}
function withScriptLock_(callback){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return callback();}finally{lock.releaseLock();}}
function ensureLiveSheet_(){const spreadsheet=spreadsheet_();let sheet=spreadsheet.getSheetByName(TABS.live);const headers=['cle','horodatage','courriel','nom','groupes','affectationId','titre','matriceId','exerciceId','exercice','reponsesJson','reponsesDonnees','reponsesTotal','etat'];if(!sheet){sheet=spreadsheet.insertSheet(TABS.live);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#17243c').setFontColor('#ffffff');sheet.setTabColor('#2f716a');sheet.setColumnWidth(2,155);sheet.setColumnWidth(3,245);sheet.setColumnWidth(4,180);sheet.setColumnWidth(7,230);sheet.setColumnWidth(10,250);sheet.hideColumns(1);sheet.hideColumns(11);}return sheet;}

function publicAssignment_(item){return { id:String(item.id),title:item.titre,mode:item.mode,groupCodes:splitList_(item.groupes),matrixIds:splitList_(item.matrices),exerciseIds:splitList_(item.exercices),dueAt:item.echeance || '',attempts:Number(item.tentatives)||1,feedback:isTrue_(item.retroaction) };}
function isOpen_(item){const now=Date.now(),start=item.debut?new Date(item.debut).getTime():0,end=item.echeance?new Date(item.echeance).getTime():Infinity;return now>=start&&now<=end;}
function requireTeacher_(session){if(session.role!=='enseignant')throw appError_('Accès réservé à l’enseignant.','FORBIDDEN');}
function requireSession_(token){if(!token)throw appError_('Reconnecte-toi pour continuer.','AUTH_REQUIRED');const parts=String(token).split('.');if(parts.length!==2||signature_(parts[0])!==parts[1])throw appError_('Ta session est invalide.','AUTH_REQUIRED');const data=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());if(Number(data.exp)<Date.now())throw appError_('Ta session est expirée.','AUTH_REQUIRED');return data;}
function signToken_(data){const payload=Utilities.base64EncodeWebSafe(JSON.stringify(data)).replace(/=+$/,'');return payload+'.'+signature_(payload);}
function signature_(value){const secret=PropertiesService.getScriptProperties().getProperty('APP_SECRET');if(!secret)throw appError_('L’application doit être configurée.','SETUP_REQUIRED');return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,secret)).replace(/=+$/,'');}
function digest_(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value))).replace(/=+$/,'');}
function normalizeEmail_(value){const email=String(value||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';}
function splitList_(value){return String(value||'').split(',').map(item=>item.trim()).filter(Boolean);}
function intersects_(a,b){const set=new Set((b||[]).map(String));return (a||[]).some(value=>set.has(String(value)));}
function isTrue_(value){return value===true||String(value).toLowerCase()==='true'||String(value)==='1';}
function appError_(message,code){const error=new Error(message);error.code=code;return error;}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function spreadsheet_(){const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw appError_('Le tableau doit être configuré.','SETUP_REQUIRED');return SpreadsheetApp.openById(id);}
function readObjects_(name){const sheet=spreadsheet_().getSheetByName(name);if(!sheet||sheet.getLastRow()<2)return[];const values=sheet.getDataRange().getValues(),headers=values.shift();return values.filter(row=>row.some(value=>value!=='' )).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]])));}
function appendObject_(name,obj){const sheet=spreadsheet_().getSheetByName(name),headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];sheet.appendRow(headers.map(header=>obj[header] ?? ''));}
function upsert_(name,key,value,obj){const sheet=spreadsheet_().getSheetByName(name),data=sheet.getDataRange().getValues(),headers=data[0],keyCol=headers.indexOf(key);let row=data.findIndex((values,index)=>index>0&&String(values[keyCol])===String(value));const output=headers.map(header=>obj[header] ?? '');if(row<0)sheet.appendRow(output);else sheet.getRange(row+1,1,1,output.length).setValues([output]);}
function touchLastLogin_(email){const sheet=spreadsheet_().getSheetByName(TABS.users),data=sheet.getDataRange().getValues(),headers=data[0],emailCol=headers.indexOf('courriel'),loginCol=headers.indexOf('derniereConnexion');if(loginCol<0)return;const row=data.findIndex((values,index)=>index>0&&normalizeEmail_(values[emailCol])===email);if(row>0)sheet.getRange(row+1,loginCol+1).setValue(new Date());}
function findUser_(email){return readObjects_(TABS.users).find(user=>normalizeEmail_(user.courriel)===email);}
function countStudents_(code){return readObjects_(TABS.users).filter(user=>user.role==='eleve'&&isTrue_(user.actif)&&splitList_(user.groupes).includes(String(code))).length;}
