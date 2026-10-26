(() => {
 'use strict';
 if(window.CardinalGroupOverview)return;
 const el=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const core=window.CardinalOverviewCore;
 let data=null,revision=0,grouped=false,editing=false,lastFilters=null;
 const editor=window.CardinalOverviewEditor.create({
  parse:(value,max)=>gradeValue(value,max),
  save:async(cell,parsed)=>{
   if(cell.readOnly||cell.year!==state.schoolYear||cell.group!==state.dashboardGroup||cell.token!==state.teacherToken)throw Error('La destination a changé. Relis les notes.');
   await api(TEACHER_ENDPOINT,{action:'saveResult',token:cell.token,schoolYear:cell.year,assignmentId:cell.assignment.id,email:cell.student.email,grade:parsed.grade,rawGrade:parsed.rawGrade,expectedResult:{grade:cell.result.grade??null,maxScore:cell.assignment.maxScore}});
  },
  onSaved:(cell,grade)=>{cell.result.grade=grade;refreshSummaries();},
  onState:(message,kind)=>{if(el('overviewSaveState')){el('overviewSaveState').textContent=message;el('overviewSaveState').className='hint overview-save '+kind;}}
 });
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function tableMarkup(input,options={}){
  const term=String(options.term||'all'),threshold=Number(options.threshold??60),points=options.scale==='points',search=normalize(options.search);
  const works=core.orderWorks((input.assignments||[]).filter(a=>term==='all'||Number(a.term||1)===Number(term)),options.grouped);
  const students=(input.students||[]).filter(s=>!search||normalize(`${s.name} ${s.email}`).includes(search)).sort((a,b)=>String(a.lastName||a.name||'').localeCompare(String(b.lastName||b.name||''),'fr',{sensitivity:'base'})||String(a.firstName||'').localeCompare(String(b.firstName||''),'fr',{sensitivity:'base'}));
  if(!works.length)return{html:'<p class="group-empty">Aucun travail pour cette année, ce groupe et cette étape.</p>',studentCount:students.length,workCount:0,failures:0,ungraded:0};
  if(students.length*works.length>40000)return{html:'<p class="group-empty">Cette sélection est très grande. Choisis une étape ou recherche quelques élèves pour afficher le tableau rapidement.</p>',studentCount:students.length,workCount:works.length,failures:0,ungraded:0};
  let failures=0,ungraded=0;
  const rows=students.map(s=>`<tr><th scope="row" class="overview-name">${escape([s.lastName,s.firstName].filter(Boolean).join(', ')||s.name)}</th>${works.map(a=>{
   const result=s.results?.[a.id],grade=result?.grade,percent=gradePercentage(grade,a.maxScore);
   const failing=isFailingGrade(grade,a.maxScore,threshold);if(failing)failures++;
   if(result&&percent===null)ungraded++;
   const text=percent===null?'—':points?`${formatNumber(grade,3)} / ${formatNumber(a.maxScore,3)}`:formatGradePercent(grade,a.maxScore,threshold);
   const editable=options.editable&&result&&Number(a.maxScore)>0;
   const content=editable?`<input class="overview-note" inputmode="decimal" type="text" value="${escape(grade==null?'':formatNumber(grade,3))}" data-work="${escape(a.id)}" data-student="${escape(s.email)}" aria-label="${escape(s.name+' · '+a.title+' · note sur '+a.maxScore)}"><span class="overview-cell-note">sur ${escape(formatNumber(a.maxScore))} · <span data-cell-percent>${escape(formatGradePercent(grade,a.maxScore,threshold))}</span></span>`:escape(text);
   return `<td data-result-work="${escape(a.id)}" class="${failing?'overview-failure':percent===null?'overview-ungraded':''}" title="${escape(!result?'Non inscrit à ce travail':percent===null?'Non noté':s.name+' · '+text+(failing?' · Échec':''))}">${content}${failing||editable?`<span class="overview-cell-note" data-cell-failure${failing?'':' hidden'}>Échec</span>`:''}</td>`;
  }).join('')}</tr>`).join('');
  const footer=works.map(a=>{
   const grades=students.map(s=>s.results?.[a.id]?.grade).filter(g=>gradePercentage(g,a.maxScore)!==null);
   const average=grades.length?grades.reduce((sum,g)=>sum+Number(g),0)/grades.length:null;
   return `<td>${escape(formatGradePercent(average,a.maxScore))}<small class="overview-cell-note">${grades.length} notes</small></td>`;
  }).join('');
  const spans=[];for(const work of works){const key=core.competency(work);if(spans.at(-1)?.key===key)spans.at(-1).count++;else spans.push({key,count:1});}
  const groupsRow=options.grouped?`<tr class="overview-competency-row"><th class="overview-name" scope="col">Compétence</th>${spans.map(g=>`<th scope="colgroup" colspan="${g.count}">${escape(core.label(g.key))}</th>`).join('')}</tr>`:'';
  const footerHtml=`<tr><th scope="row" class="overview-name">Moyenne des élèves affichés</th>${footer}</tr>`;
  return{html:`<table class="overview-table${options.grouped?' grouped':''}"><thead>${groupsRow}<tr><th scope="col" class="overview-name">Élève</th>${works.map(a=>`<th scope="col"><button type="button" class="overview-work-link" data-overview-assignment="${escape(a.id)}">${escape(a.title)}</button><small>${escape(core.label(core.competency(a)))} · Étape ${Number(a.term||1)} · ${a.maxScore>0?'sur '+escape(formatNumber(a.maxScore))+' points':'Maximum à compléter'}</small></th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${works.length+1}">Aucun élève pour cette recherche.</td></tr>`}</tbody><tfoot>${footerHtml}</tfoot></table>`,footerHtml,studentCount:students.length,workCount:works.length,failures,ungraded};
 }
 function options(){return{term:el('overviewTerm').value,scale:el('overviewScale').value,search:el('overviewSearch').value,threshold:state.passingThreshold??60,grouped,editable:editing&&!data?.context?.readOnly};}
 function followUp(){
  if(!data||!el('overviewRiskContent'))return;
  const threshold=Number(el('overviewRiskThreshold').value);
  const report=core.followUp(data,{term:el('overviewTerm').value,threshold:Number.isFinite(threshold)?threshold:70,passing:state.passingThreshold??60});
  const concerns=report.filter(r=>r.level==='failure'||r.level==='watch'),incomplete=report.filter(r=>r.level==='insufficient'||r.level==='incomplete');
  el('overviewRiskSummary').textContent=`${new Set(concerns.map(r=>r.email)).size} élèves à surveiller · ${new Set(incomplete.map(r=>r.email)).size} avec des données à compléter`;
  const table=(rows,empty)=>rows.length?`<div class="overview-risk-scroll"><table class="overview-risk-table"><thead><tr><th>Élève</th><th>Compétence</th><th>Étape</th><th>Résultat</th><th>Repères</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${escape(r.name)}</th><td>${escape(r.label)}</td><td>${r.term}</td><td class="${r.level==='failure'?'overview-failure':''}">${r.average===null?'—':escape(formatGradePercent(r.average,100,state.passingThreshold??60))}<small>${r.average===null?'Données insuffisantes':r.method==='weighted'?'Moyenne pondérée':'Moyenne indicative non pondérée'}</small></td><td>${r.graded} note${r.graded===1?'':'s'}${r.provisional?' · repère provisoire':''}${r.failures?' · '+r.failures+' échec'+(r.failures>1?'s':''):''}${r.missing?' · '+r.missing+' non noté'+(r.missing>1?'s':''):''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="hint">${escape(empty)}</p>`;
  el('overviewRiskContent').innerHTML='<h3>Résultats à surveiller</h3>'+table(concerns,'Aucun élève signalé avec les critères choisis.')+'<h3>Données à compléter</h3>'+table(incomplete,'Aucune donnée manquante parmi les travaux pris en compte.');
 }
 function refreshSummaries(){
  if(!data)return;const result=tableMarkup(data,options());
  el('overviewSummary').textContent=`${result.studentCount} élèves · ${result.workCount} travaux · ${result.failures} résultats en échec · ${result.ungraded} non notés`;
  const footer=el('overviewContent').querySelector?.('tfoot');if(footer)footer.innerHTML=result.footerHtml||'';
  followUp();
 }
 function bindInputs(){
  for(const input of el('overviewContent').querySelectorAll('.overview-note')){
   const assignment=data.assignments.find(a=>a.id===input.dataset.work),student=data.students.find(s=>s.email===input.dataset.student);
   const cell={assignment,student,result:student.results[assignment.id],year:data.schoolYear,group:data.groupCode,token:state.teacherToken,readOnly:data.context?.readOnly};editor.track(input,cell);
   const preview=()=>{const td=input.closest('td');try{const parsed=gradeValue(input.value,assignment.maxScore);td.classList.toggle('overview-failure',isFailingGrade(parsed.rawGrade??parsed.grade,assignment.maxScore,state.passingThreshold??60));td.querySelector('[data-cell-percent]').textContent=formatGradePercent(parsed.rawGrade??parsed.grade,assignment.maxScore,state.passingThreshold??60);const failure=td.querySelector('[data-cell-failure]');if(failure)failure.hidden=!td.classList.contains('overview-failure');}catch{}};
   input.oninput=preview;input.onblur=()=>editor.commit(input).then(preview);
   input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();editor.commit(input).then(preview);const inputs=[...el('overviewContent').querySelectorAll('.overview-note')];inputs[inputs.indexOf(input)+1]?.focus();}else if(event.key==='Escape'){event.preventDefault();if(editor.cancel(input))preview();}};
  }
 }
 function render(){
  if(!data)return;
  editor.clear();const result=tableMarkup(data,options());
  lastFilters={overviewTerm:el('overviewTerm').value,overviewScale:el('overviewScale').value,overviewSearch:el('overviewSearch').value};
  el('overviewContent').innerHTML=result.html;
  el('overviewSummary').textContent=`${result.studentCount} élèves · ${result.workCount} travaux · ${result.failures} résultats en échec · ${result.ungraded} non notés`;
  for(const button of el('overviewContent').querySelectorAll('[data-overview-assignment]'))button.onclick=()=>openAssignment(button.dataset.overviewAssignment);
  bindInputs();followUp();
 }
 async function show(){
  const mine=++revision,year=state.schoolYear,group=state.dashboardGroup,token=state.teacherToken;
  data=null;editing=false;editor.clear();
  if(el('overviewEdit')){el('overviewEdit').disabled=true;el('overviewEdit').textContent='Modifier les notes';el('overviewEdit').setAttribute('aria-pressed','false');}
  if(el('overviewRiskContent'))el('overviewRiskContent').innerHTML='';if(el('overviewRiskSummary'))el('overviewRiskSummary').textContent='';
  const groups=dashboardGroups();el('overviewGroup').innerHTML=groups.map(g=>`<option value="${escape(g)}">Groupe ${escape(g)}</option>`).join('');el('overviewGroup').value=group||'';
  el('overviewThreshold').value=String(state.passingThreshold??60);el('overviewTitle').textContent=`Résultats du groupe ${group||'—'} · ${year?`${year}–${Number(year)+1}`:''}`;
  if(!group||!year){data=null;el('overviewContent').innerHTML='<p class="group-empty">Choisis une année et un groupe.</p>';return;}
  el('overviewContent').innerHTML='<p class="group-empty">Lecture des résultats…</p>';
  try{
   const result=await api(TEACHER_ENDPOINT,{action:'groupYearOverview',token,schoolYear:year,groupCode:group});
   if(mine!==revision||year!==state.schoolYear||group!==state.dashboardGroup||token!==state.teacherToken||state.teacherSection!=='overview')return;
   if(result.schoolYear!==undefined&&Number(result.schoolYear)!==year||result.groupCode!==undefined&&String(result.groupCode)!==group)throw Error('La réponse reçue appartient à une autre année ou à un autre groupe.');
   data={...result,schoolYear:year,groupCode:group};editing=false;editor.clear();if(el('overviewEdit')){el('overviewEdit').disabled=!!result.context?.readOnly;el('overviewEdit').textContent='Modifier les notes';el('overviewEdit').setAttribute('aria-pressed','false');}if(el('overviewSaveState'))el('overviewSaveState').textContent='';render();
  }catch(error){if(mine===revision){el('overviewContent').innerHTML=`<p class="group-empty">${escape(error.message)}</p>`;el('overviewSummary').textContent='';}}
 }
 async function prepareNavigation(){const ok=await editor.flush();if(!ok&&typeof notify==='function')notify('Une saisie n’est pas enregistrée. Corrige-la ou utilise « Relire les notes ».','error');return ok;}
 async function renderAfterSaving(){if(await prepareNavigation())render();else if(lastFilters)for(const [id,value] of Object.entries(lastFilters))el(id).value=value;}
 window.CardinalGroupOverview={show,render,tableMarkup,prepareNavigation};
 for(const id of ['overviewTerm','overviewScale'])if(el(id))el(id).onchange=renderAfterSaving;
 if(el('overviewSearch'))el('overviewSearch').oninput=renderAfterSaving;
 if(el('overviewGroupCompetency'))el('overviewGroupCompetency').onclick=async()=>{if(!await prepareNavigation())return;grouped=!grouped;el('overviewGroupCompetency').setAttribute('aria-pressed',String(grouped));render();};
 if(el('overviewEdit'))el('overviewEdit').onclick=async()=>{if(!data||data.context?.readOnly||!await prepareNavigation())return;editing=!editing;el('overviewEdit').textContent=editing?'Terminer la saisie':'Modifier les notes';el('overviewEdit').setAttribute('aria-pressed',String(editing));if(el('overviewSaveState'))el('overviewSaveState').textContent=editing?'Saisie en points. Entrée ou Tab enregistre; Échap annule une saisie.':'';render();};
 if(el('overviewReload'))el('overviewReload').onclick=async()=>{await editor.settle();if(editor.hasUnsaved()&&!window.confirm('Relire les notes enregistrées et abandonner les saisies non confirmées ?'))return;editor.clear();await show();};
 if(el('overviewRiskThreshold'))el('overviewRiskThreshold').onchange=()=>{const n=Number(el('overviewRiskThreshold').value);if(!Number.isFinite(n)||n<0||n>100)el('overviewRiskThreshold').value='70';followUp();};
 if(el('overviewGroup'))el('overviewGroup').onchange=async()=>{if(await selectDashboardGroup(el('overviewGroup').value,true)===false)el('overviewGroup').value=state.dashboardGroup;};
 if(el('overviewThreshold'))el('overviewThreshold').onchange=async()=>{
  if(!await prepareNavigation())return;
  const raw=el('overviewThreshold').value,n=Number(raw);if(raw===''||!Number.isFinite(n)||n<0||n>100){el('overviewThreshold').value=String(state.passingThreshold??60);return;}
  state.passingThreshold=n;if(el('failureThreshold'))el('failureThreshold').value=String(n);
  localStorage.setItem('results_passing_threshold:'+(state.teacherEmail||''),String(n));render();
 };
 window.addEventListener('cardinal-year-changed',()=>{revision++;data=null;if(el('overviewTerm'))el('overviewTerm').value='all';});
 window.addEventListener('beforeunload',event=>{if(editor.hasUnsaved()){event.preventDefault();event.returnValue='';}});
})();
