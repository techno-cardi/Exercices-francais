(() => {
 'use strict';
 if(window.CardinalSchoolYears)return;
 const el=id=>document.getElementById(id),html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 let session=null,selectionRevision=0;
 const label=y=>`${y}–${Number(y)+1}`;
 function adopt(context){
  if(!context)return;
  if(state.schoolYear!==context.year)state.schoolYearRevision=(state.schoolYearRevision||0)+1;
  state.schoolYear=context.year;state.yearContext=context;state.schoolYears=context.catalog?.years||[];
  localStorage.setItem('results_school_year',String(context.year));
  const select=el('schoolYearSelect');
  if(select){select.innerHTML=state.schoolYears.map(y=>`<option value="${y.year}">${html(y.label)}${y.status==='archived'?' · Archive':y.status==='draft'?' · Préparation':y.year===context.activeYear?' · Active':' · Corrections ouvertes'}</option>`).join('');select.value=String(context.year);}
  const status=el('schoolYearStatus');if(status)status.textContent=context.isActive?'Année active':context.status==='archived'?'Archive · consultation':context.status==='draft'?'Année en préparation':'Corrections autorisées';
  const banner=el('schoolYearArchiveBanner');if(banner){banner.classList.toggle('hidden',context.isActive);banner.textContent=context.status==='archived'?`${label(context.year)} — Archive protégée. Les anciennes notes, commentaires et listes d’élèves restent consultables.`:context.status==='draft'?`${label(context.year)} — Préparation des listes. L’année active ${label(context.activeYear)} reste inchangée.`:`${label(context.year)} — Corrections manuelles autorisées. Les imports et envois restent réservés à ${label(context.activeYear)}.`;}
  for(const id of ['newAssignmentBtn','newAssignmentBtn2','importMozaikWorks'])if(el(id))el(id).disabled=!context.isActive||context.readOnly;
 }
 async function selectYear(value,options={}){
  const year=Number(value);if(!Number.isSafeInteger(year))return false;
  if(!await prepareAssignmentNavigation()){if(el('schoolYearSelect'))el('schoolYearSelect').value=String(state.schoolYear);return false;}
  const previous={schoolYear:state.schoolYear,yearContext:state.yearContext,currentAssignment:state.currentAssignment,currentStudents:state.currentStudents,detailGroup:state.detailGroup,teacherAssignments:state.teacherAssignments,groupStats:state.groupStats,teacherDataYear:state.teacherDataYear,dashboardGroup:state.dashboardGroup,teacherSection:state.teacherSection};
  const revision=++selectionRevision;
  state.navigationRevision=(state.navigationRevision||0)+1;state.schoolYearRevision=(state.schoolYearRevision||0)+1;
  state.schoolYear=year;state.currentAssignment=null;state.currentStudents=[];state.detailGroup='';
  window.dispatchEvent(new CustomEvent('cardinal-group-changed'));window.dispatchEvent(new CustomEvent('cardinal-year-changed'));
  try{
   if(await refreshTeacherData()===false||revision!==selectionRevision)return false;
   window.CardinalGroupUI?.refresh();renderDashboard();renderAssignmentList();
   const section=options.section||(previous.teacherSection==='overview'?'overview':'assignments');setTeacherSection(section);
   if(options.route!==false)setGroupRoute('',state.dashboardGroup,options.replace?'replace':'push',section);
   return true;
  }catch(error){
   if(revision===selectionRevision){Object.assign(state,previous);adopt(previous.yearContext);window.CardinalGroupUI?.refresh();renderDashboard();renderAssignmentList();setTeacherSection(previous.teacherSection||'assignments');if(previous.currentAssignment){fillWorkPage();renderGradeRows();}}
   notify(error.message,'error');return false;
  }
 }
 function applyAssignmentAccess(a){
  if(!a)return;const readOnly=!!a.readOnly,external=readOnly||a.isActiveYear===false;
  if(el('gradeHelp'))el('gradeHelp').textContent=readOnly?'Archive en consultation. Les notes et les rétroactions sont conservées.':'Entre une note, puis fais Entrée ou Tab pour passer à l’élève suivant.';
  for(const input of document.querySelectorAll('#workSettings input,#workSettings select,#workSettings textarea')){
   if(input.closest('#groupChoices'))input.disabled=!!a.id;else input.disabled=readOnly;
  }
  for(const id of ['topPublishedToggle','topMozaikVisibleToggle','saveAssignmentBtn'])if(el(id))el(id).disabled=readOnly||(id==='saveAssignmentBtn'&&a.id&&a.groups?.length>1);
  for(const input of document.querySelectorAll('#studentRows .grade-input'))input.disabled=readOnly||!(a.maxScore>0);
  for(const id of ['syncMozaikBtn','resumeMozaikBtn','recoverMozaikBtn','formativeAssociateBtn','formativePullBtn','formativePushBtn'])if(el(id)&&external)el(id).disabled=true;
  if(el('appendAssignmentStudents')){el('appendAssignmentStudents').hidden=!a.id||external;el('appendAssignmentStudents').disabled=external;}
  if(el('reuseArchivedAssignment'))el('reuseArchivedAssignment').classList.toggle('hidden',!a.id||a.isActiveYear!==false);
 }
 function valid(s){return session===s&&el('schoolYearDialog')?.open&&s.token===state.teacherToken;}
 function close(){session=null;el('schoolYearDialog')?.close();}
 function ensureDialog(){
  if(el('schoolYearDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='schoolYearDialog';dialog.className='dialog year-dialog';
  dialog.innerHTML='<div class="dialog-head"><h2>Années scolaires et archives</h2><button type="button" class="icon-btn" id="yearManagerClose" aria-label="Fermer">×</button></div><div class="dialog-body"><div id="yearManagerMain"></div><div id="yearManagerPreview"></div><p id="yearManagerError" role="alert"></p></div><div class="dialog-actions"><button type="button" class="btn btn-ghost" id="yearManagerCancel">Fermer</button><button type="button" class="btn btn-primary hidden" id="yearManagerConfirm">Confirmer</button></div>';
  document.body.append(dialog);el('yearManagerClose').onclick=close;el('yearManagerCancel').onclick=close;
  el('yearManagerConfirm').onclick=confirm;dialog.addEventListener('close',()=>{session=null;});dialog.addEventListener('cancel',()=>{session=null;});
 }
 async function reloadCatalog(s){
  const catalog=await api(TEACHER_ENDPOINT,{action:'schoolYearCatalog',token:s.token});if(!valid(s))return;
  s.catalog=catalog;const current=catalog.years.find(y=>y.year===state.schoolYear);
  if(current)adopt({...current,year:current.year,activeYear:catalog.activeYear,isActive:current.year===catalog.activeYear,readOnly:current.status!=='open',catalog});
 }
 function renderManager(s){
  if(!valid(s))return;const target=s.catalog.years.find(y=>y.year===s.target)||s.catalog.years[0];s.target=target?.year;
  const draft=target?.status==='draft',active=target?.year===s.catalog.activeYear;
  const pending=s.catalog.pendingJobs||[];
  el('yearManagerMain').innerHTML=`<p class="hint">Année active : <strong>${label(s.catalog.activeYear)}</strong>. Choisir une archive ne change jamais cette année active.</p><div class="year-create"><label>Préparer une nouvelle année<input id="yearManagerNew" class="input" type="number" min="2000" max="2199" value="${Number(s.catalog.activeYear)+1}"></label><button id="yearManagerCreate" type="button" class="btn btn-ghost">Préparer l’année</button></div><label class="field-label" for="yearManagerTarget">Année à gérer</label><select id="yearManagerTarget" class="select">${s.catalog.years.map(y=>`<option value="${y.year}"${y.year===s.target?' selected':''}>${html(y.label)} · ${y.status==='draft'?'Préparation':y.status==='archived'?'Archive':y.year===s.catalog.activeYear?'Active':'Corrections ouvertes'} · ${y.studentCount} élèves · ${y.assignmentCount} travaux</option>`).join('')}</select><div class="year-target-actions">${draft?'<button id="yearManagerActivate" type="button" class="btn btn-primary">Activer et archiver l’année précédente</button>':''}${target?.status==='archived'?'<button id="yearManagerReopen" type="button" class="btn btn-ghost">Autoriser les corrections manuelles</button>':''}${!active&&target?.status==='open'?'<button id="yearManagerArchive" type="button" class="btn btn-ghost">Refermer cette archive</button>':''}</div>`+
   ((draft||active)&&target?.status!=='archived'?`<div class="year-section"><h3>Importer les élèves de ${label(s.target)}</h3><p>CSV : courriel, groupe, prénom, nom. La fiche à 7 chiffres est nécessaire seulement pour un nouvel élève. Les accès des comptes existants sont conservés.</p><input id="yearManagerFile" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"><label class="field-label" for="yearManagerCsv">Ou coller la liste CSV</label><textarea id="yearManagerCsv" class="textarea year-roster-text" placeholder="courriel;groupe;prénom;nom;fiche"></textarea><label class="field-label" for="yearManagerMode">Mode</label><select id="yearManagerMode" class="select"><option value="merge">Compléter / mettre à jour les élèves indiqués</option>${draft?'<option value="replace">Remplacer la liste de ce brouillon uniquement</option>':''}</select><p>Une ligne absente ne retire pas un élève en mode compléter. La colonne facultative « actif » permet d’indiquer explicitement non. Aucune note ni rétroaction n’est effacée.</p><button id="yearManagerRoster" type="button" class="btn btn-ghost">Prévisualiser la liste</button></div>`:'')+
   (pending.length?`<div class="year-section"><h3>Envois Mozaïk à terminer</h3>${pending.map(j=>`<div class="year-pending-item"><span>${html(j.title)} · ${label(j.schoolYear)} · ${j.status==='ready'?'Préparé':'En cours'}</span><button type="button" class="btn btn-ghost" data-year-job-open="${html(j.assignmentId)}">Ouvrir</button>${j.canCancel?`<button type="button" class="btn btn-ghost" data-year-job-cancel="${html(j.id)}">Annuler la préparation</button>`:''}</div>`).join('')}</div>`:'');
  el('yearManagerTarget').onchange=()=>{s.target=Number(el('yearManagerTarget').value);clearPreview(s);renderManager(s);};
  el('yearManagerCreate').onclick=()=>prepare(s,'create',{year:Number(el('yearManagerNew').value)});
  if(el('yearManagerActivate'))el('yearManagerActivate').onclick=()=>prepare(s,'activate',{year:s.target});
  if(el('yearManagerReopen'))el('yearManagerReopen').onclick=()=>prepare(s,'reopen',{year:s.target});
  if(el('yearManagerArchive'))el('yearManagerArchive').onclick=()=>prepare(s,'archive',{year:s.target});
  if(el('yearManagerFile'))el('yearManagerFile').onchange=async()=>{const file=el('yearManagerFile').files?.[0];if(file){if(file.size>2000000){el('yearManagerError').textContent='Le fichier dépasse 2 Mo.';return;}el('yearManagerCsv').value=await file.text();}};
  if(el('yearManagerRoster'))el('yearManagerRoster').onclick=async()=>{
   try{const rows=window.CardinalYearRosterCsv.parse(el('yearManagerCsv').value);const mode=el('yearManagerMode').value;el('yearManagerCsv').value='';el('yearManagerFile').value='';await prepare(s,'roster',{year:s.target,rows,mode});}
   catch(error){if(valid(s))el('yearManagerError').textContent=error.message;}
  };
  for(const button of el('yearManagerMain').querySelectorAll('[data-year-job-open]'))button.onclick=()=>{const id=button.dataset.yearJobOpen;close();openAssignment(id);};
  for(const button of el('yearManagerMain').querySelectorAll('[data-year-job-cancel]'))button.onclick=async()=>{if(s.busy)return;s.busy=true;try{await api(TEACHER_ENDPOINT,{action:'schoolYearCancelReady',token:s.token,jobId:button.dataset.yearJobCancel});await reloadCatalog(s);renderManager(s);}catch(error){if(valid(s))el('yearManagerError').textContent=error.message;}finally{s.busy=false;}};
 }
 function clearPreview(s){s.previewId=null;el('yearManagerPreview').innerHTML='';el('yearManagerError').textContent='';el('yearManagerConfirm').classList.add('hidden');}
 async function prepare(s,kind,request){
  if(!valid(s)||s.busy)return;s.busy=true;clearPreview(s);
  try{
   const data=await api(TEACHER_ENDPOINT,{action:'schoolYearPreview',token:s.token,kind,request});if(!valid(s))return;
   s.previewId=data.previewId;s.kind=kind;s.preview=data.preview;const p=data.preview;
   let content='';
   if(kind==='create')content=`L’année ${label(p.year)} sera créée en préparation. L’année active reste ${label(p.activeYear)}.`;
   if(kind==='activate')content=`${label(p.activeYear)} deviendra une archive protégée; ${label(p.year)} deviendra active avec ${p.studentCount} élèves dans ${p.groupCount} groupes. ${p.preservedAssignments} travaux et ${p.preservedResults} résultats de l’ancienne année seront conservés. Aucun résultat ni commentaire ne sera recopié dans la nouvelle année.`;
   if(kind==='roster')content=`${p.rowCount} élèves, ${p.groupCount} groupes : ${p.newStudents} nouveaux comptes et ${p.knownStudents} comptes existants. ${p.mode==='replace'?'La liste de ce brouillon sera remplacée.':'Seuls les élèves indiqués seront ajoutés ou mis à jour.'} Les notes et les commentaires restent inchangés.`;
   if(kind==='archive')content=`Les corrections de ${label(p.year)} seront refermées. Les résultats resteront consultables.`;
   if(kind==='reopen')content=`Les corrections manuelles de ${label(p.year)} seront autorisées. L’année active et les destinations Formative/Mozaïk ne changeront pas.`;
   if(kind==='roster_append')content=`${p.addedCount} élèves seront ajoutés à la liste du travail. Aucun ancien élève, résultat ou commentaire ne sera retiré.`;
   const members=p.members||[];
   el('yearManagerPreview').innerHTML=`<div class="year-section"><h3>Vérifier avant de confirmer</h3><p>${html(content)}</p>${members.length?`<div class="year-preview-scroll"><table class="year-preview-table"><thead><tr><th>Élève</th><th>Groupe</th><th>Changement</th></tr></thead><tbody>${members.map(m=>`<tr><td>${html(m.name)}</td><td>${html(m.group)}</td><td>${html(m.action||'Ajout')}${m.previousGroup&&m.previousGroup!==m.group?' · auparavant '+html(m.previousGroup):''}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;
   el('yearManagerConfirm').textContent=kind==='activate'?'Confirmer le changement d’année':kind==='roster_append'?'Ajouter ces élèves':'Confirmer';el('yearManagerConfirm').classList.remove('hidden');
  }catch(error){if(valid(s))el('yearManagerError').textContent=error.message;}
  finally{if(valid(s)){s.busy=false;el('yearManagerConfirm').disabled=false;}}
 }
 async function confirm(){
  const s=session;if(!s||!valid(s)||s.busy||!s.previewId)return;s.busy=true;el('yearManagerConfirm').disabled=true;
  try{
   const result=await api(TEACHER_ENDPOINT,{action:'schoolYearConfirm',token:s.token,previewId:s.previewId});if(!valid(s))return;
   clearPreview(s);await reloadCatalog(s);if(!valid(s))return;
   if(result.kind==='activate'){close();await selectYear(result.activeYear);notify('Nouvelle année activée. Les anciennes notes sont conservées dans les archives.');return;}
   if(result.kind==='roster_append'){const id=s.assignmentId;close();await openAssignment(id);notify('Liste du travail mise à jour.');return;}
   s.target=result.year;await refreshTeacherData();renderDashboard();renderAssignmentList();renderManager(s);el('yearManagerError').textContent='Opération enregistrée.';
  }catch(error){if(valid(s))el('yearManagerError').textContent=error.message;}
  finally{if(valid(s)){s.busy=false;el('yearManagerConfirm').disabled=false;}}
 }
 async function openManager(){
  ensureDialog();session={token:state.teacherToken,target:state.schoolYear,busy:false,previewId:null};const s=session;
  el('schoolYearDialog').showModal();el('yearManagerMain').textContent='Chargement…';clearPreview(s);
  try{await reloadCatalog(s);renderManager(s);}catch(error){if(valid(s))el('yearManagerError').textContent=error.message;}
 }
 async function appendStudents(){
  const a=state.currentAssignment;if(!a?.id||a.readOnly||a.isActiveYear===false)return;
  await openManager();const s=session;if(!s)return;s.assignmentId=a.id;el('yearManagerMain').innerHTML=`<h3>${html(a.title)}</h3>`;
  await prepare(s,'roster_append',{year:a.schoolYear,assignmentId:a.id});
 }
 async function reuseAssignment(){
  const source=state.currentAssignment;if(!source?.id)return;
  const active=state.yearContext?.activeYear;if(!active)return;
  if(!await selectYear(active))return;if(await newAssignment()===false)return;
  const fields=['title','competenceKind','competencies','weight','maxScore','instructions','term','activityType','reportCardEnabled','homework','period'];
  for(const key of fields)state.currentAssignment[key]=Array.isArray(source[key])?[...source[key]]:source[key];
  state.currentAssignment.published=false;state.currentAssignment.resultsVisible=false;fillWorkPage();renderGradeRows();
  notify('Paramètres repris dans un nouveau travail. Choisis les groupes puis enregistre.');
 }
 window.CardinalSchoolYears={adopt,selectYear,applyAssignmentAccess,openManager,appendStudents,reuseAssignment};
 if(el('schoolYearSelect'))el('schoolYearSelect').onchange=()=>selectYear(el('schoolYearSelect').value);
 if(el('manageSchoolYears'))el('manageSchoolYears').onclick=openManager;
 if(el('appendAssignmentStudents'))el('appendAssignmentStudents').onclick=appendStudents;
 if(el('reuseArchivedAssignment'))el('reuseArchivedAssignment').onclick=reuseAssignment;
 window.addEventListener('cardinal-year-changed',close);
 if(state.yearContext)adopt(state.yearContext);
})();
