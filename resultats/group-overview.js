(() => {
 'use strict';
 if(window.CardinalGroupOverview)return;
 const el=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 let data=null,revision=0;
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function tableMarkup(input,options={}){
  const term=String(options.term||'all'),threshold=Number(options.threshold??60),points=options.scale==='points',search=normalize(options.search);
  const works=(input.assignments||[]).filter(a=>term==='all'||Number(a.term||1)===Number(term));
  const students=(input.students||[]).filter(s=>!search||normalize(`${s.name} ${s.email}`).includes(search)).sort((a,b)=>String(a.lastName||a.name||'').localeCompare(String(b.lastName||b.name||''),'fr',{sensitivity:'base'})||String(a.firstName||'').localeCompare(String(b.firstName||''),'fr',{sensitivity:'base'}));
  if(!works.length)return{html:'<p class="group-empty">Aucun travail pour cette année, ce groupe et cette étape.</p>',studentCount:students.length,workCount:0,failures:0,ungraded:0};
  if(students.length*works.length>40000)return{html:'<p class="group-empty">Cette sélection est très grande. Choisis une étape ou recherche quelques élèves pour afficher le tableau rapidement.</p>',studentCount:students.length,workCount:works.length,failures:0,ungraded:0};
  let failures=0,ungraded=0;
  const rows=students.map(s=>`<tr><th scope="row" class="overview-name">${escape([s.lastName,s.firstName].filter(Boolean).join(', ')||s.name)}</th>${works.map(a=>{
   const result=s.results?.[a.id],grade=result?.grade,percent=gradePercentage(grade,a.maxScore);
   const failing=isFailingGrade(grade,a.maxScore,threshold);if(failing)failures++;
   if(result&&percent===null)ungraded++;
   const text=percent===null?'—':points?`${formatNumber(grade,3)} / ${formatNumber(a.maxScore,3)}`:formatGradePercent(grade,a.maxScore,threshold);
   return `<td class="${failing?'overview-failure':percent===null?'overview-ungraded':''}" title="${escape(!result?'Non inscrit à ce travail':percent===null?'Non noté':s.name+' · '+text+(failing?' · Échec':''))}">${escape(text)}${failing?'<span class="overview-cell-note">Échec</span>':''}</td>`;
  }).join('')}</tr>`).join('');
  const footer=works.map(a=>{
   const grades=students.map(s=>s.results?.[a.id]?.grade).filter(g=>gradePercentage(g,a.maxScore)!==null);
   const average=grades.length?grades.reduce((sum,g)=>sum+Number(g),0)/grades.length:null;
   return `<td>${escape(formatGradePercent(average,a.maxScore))}<small class="overview-cell-note">${grades.length} notes</small></td>`;
  }).join('');
  return{html:`<table class="overview-table"><thead><tr><th scope="col" class="overview-name">Élève</th>${works.map(a=>`<th scope="col"><button type="button" class="overview-work-link" data-overview-assignment="${escape(a.id)}">${escape(a.title)}</button><small>Étape ${Number(a.term||1)} · ${a.maxScore>0?'sur '+escape(formatNumber(a.maxScore))+' points':'Maximum à compléter'}</small></th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${works.length+1}">Aucun élève pour cette recherche.</td></tr>`}</tbody><tfoot><tr><th scope="row" class="overview-name">Moyenne des élèves affichés</th>${footer}</tr></tfoot></table>`,studentCount:students.length,workCount:works.length,failures,ungraded};
 }
 function render(){
  if(!data)return;
  const result=tableMarkup(data,{term:el('overviewTerm').value,scale:el('overviewScale').value,search:el('overviewSearch').value,threshold:state.passingThreshold??60});
  el('overviewContent').innerHTML=result.html;
  el('overviewSummary').textContent=`${result.studentCount} élèves · ${result.workCount} travaux · ${result.failures} résultats en échec · ${result.ungraded} non notés`;
  for(const button of el('overviewContent').querySelectorAll('[data-overview-assignment]'))button.onclick=()=>openAssignment(button.dataset.overviewAssignment);
 }
 async function show(){
  const mine=++revision,year=state.schoolYear,group=state.dashboardGroup,token=state.teacherToken;
  const groups=dashboardGroups();el('overviewGroup').innerHTML=groups.map(g=>`<option value="${escape(g)}">Groupe ${escape(g)}</option>`).join('');el('overviewGroup').value=group||'';
  el('overviewThreshold').value=String(state.passingThreshold??60);el('overviewTitle').textContent=`Résultats du groupe ${group||'—'} · ${year?`${year}–${Number(year)+1}`:''}`;
  if(!group||!year){data=null;el('overviewContent').innerHTML='<p class="group-empty">Choisis une année et un groupe.</p>';return;}
  el('overviewContent').innerHTML='<p class="group-empty">Lecture des résultats…</p>';
  try{
   const result=await api(TEACHER_ENDPOINT,{action:'groupYearOverview',token,schoolYear:year,groupCode:group});
   if(mine!==revision||year!==state.schoolYear||group!==state.dashboardGroup||token!==state.teacherToken||state.teacherSection!=='overview')return;
   data=result;render();
  }catch(error){if(mine===revision){el('overviewContent').innerHTML=`<p class="group-empty">${escape(error.message)}</p>`;el('overviewSummary').textContent='';}}
 }
 window.CardinalGroupOverview={show,render,tableMarkup};
 for(const id of ['overviewTerm','overviewScale'])if(el(id))el(id).onchange=render;
 if(el('overviewSearch'))el('overviewSearch').oninput=render;
 if(el('overviewGroup'))el('overviewGroup').onchange=()=>selectDashboardGroup(el('overviewGroup').value,true);
 if(el('overviewThreshold'))el('overviewThreshold').onchange=()=>{
  const raw=el('overviewThreshold').value,n=Number(raw);if(raw===''||!Number.isFinite(n)||n<0||n>100){el('overviewThreshold').value=String(state.passingThreshold??60);return;}
  state.passingThreshold=n;if(el('failureThreshold'))el('failureThreshold').value=String(n);
  localStorage.setItem('results_passing_threshold:'+(state.teacherEmail||''),String(n));render();
 };
 window.addEventListener('cardinal-year-changed',()=>{revision++;data=null;if(el('overviewTerm'))el('overviewTerm').value='all';});
})();
