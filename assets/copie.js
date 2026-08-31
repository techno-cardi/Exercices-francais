import { api, escapeHtml, formatDate, requireBootstrap } from './api.js';

const params=new URLSearchParams(location.search);
const email=params.get('email');
const assignmentId=params.get('assignment');
const list=document.querySelector('#copy-list');
const loading=document.querySelector('#loading');
let refreshTimer;

try{
  await requireBootstrap('enseignant');
  await loadCopy();
  refreshTimer=setInterval(()=>{if(!document.hidden)loadCopy(true);},3000);
}catch(error){loading.textContent=error.message;}

async function loadCopy(silent=false){
  try{
    const copy=await api('studentCopy',{email,assignmentId});
    document.querySelector('#student-name').textContent=copy.student.name;
    document.querySelector('#copy-title').textContent=`${copy.assignment.title} · Groupe ${(copy.student.groups||[]).join(', ')}`;
    const completed=copy.remises.filter(item=>item.status!=='en_cours');
    const earned=completed.reduce((sum,item)=>sum+item.score,0),total=completed.reduce((sum,item)=>sum+item.total,0),working=copy.remises.filter(item=>item.status==='en_cours').length;
    document.querySelector('#copy-summary').innerHTML=`<div class="copy-live-summary"><span class="live-kicker"><i></i> Actualisation automatique</span>${total?`<span class="result-pill ${earned/total>=.6?'result-ok':'result-help'}">${earned}/${total} · ${Math.round(earned/total*100)} %</span>`:''}${working?`<span class="status-pill status-working"><i></i> ${working} en cours</span>`:''}</div>`;
    list.innerHTML='';
    for(const remise of copy.remises)await renderRemise(remise);
    loading.hidden=copy.remises.length>0;
    if(!copy.remises.length){loading.hidden=false;loading.textContent='Cet élève n’a pas encore ouvert d’exercice pour cette affectation.';}
  }catch(error){if(!silent)throw error;}
}

async function renderRemise(remise){
  const matrix=await fetch(`data/matrices/${encodeURIComponent(remise.matrixId)}.json`).then(response=>response.json());
  const exercise=matrix.exercises.find(item=>String(item.id)===String(remise.exerciseId));if(!exercise)return;
  const draft=remise.status==='en_cours',card=document.createElement('article');card.className=`exercise-card copy-card ${draft?'copy-live-card':''}`;
  card.innerHTML=`<div class="copy-card-heading"><div><span class="exercise-number">${escapeHtml(exercise.displayLabel||remise.exerciseLabel||'Activité')}</span><div class="instruction">${cleanHtml(exercise.title||'')}</div></div><div>${draft?`<span class="status-pill status-working"><i></i> En cours · ${remise.answered||0}/${remise.total||0}</span>`:`<span class="result-pill ${remise.percentage>=60?'result-ok':'result-help'}">${remise.score}/${remise.total} · ${remise.percentage} %</span>`}<small>${escapeHtml(formatDate(remise.timestamp))}</small></div></div><div class="canvas-viewport"><div class="exercise-canvas"></div></div>`;
  list.append(card);
  const canvas=card.querySelector('.exercise-canvas'),viewport=card.querySelector('.canvas-viewport');canvas.style.width=`${exercise.canvas.width||650}px`;canvas.style.height=`${exercise.canvas.height||400}px`;
  for(const element of [...(exercise.canvas.elements||[])].sort((a,b)=>Number(a.metrics?.zindex||0)-Number(b.metrics?.zindex||0))){const node=renderElement(element,remise.answers[element.id]);if(!node)continue;if(Object.hasOwn(remise.details,element.id))node.classList.add(remise.details[element.id]?'correct':'incorrect');canvas.append(node);}
  const fit=()=>{const bounds=contentBounds(exercise),available=Math.max(viewport.clientWidth-24,240),scale=Math.min(1,available/bounds.width),left=Math.max(12,(viewport.clientWidth-bounds.width*scale)/2);canvas.style.transform=`translate(${left}px,12px) scale(${scale}) translate(${-bounds.x}px,${-bounds.y}px)`;viewport.style.height=`${bounds.height*scale+24}px`;};fit();new ResizeObserver(fit).observe(viewport);
}

function contentBounds(exercise){const rendered=(exercise.canvas.elements||[]).filter(element=>element.type!=='association_draggable'&&!(element.type==='linkable'&&element.linkable_type!=='source'));if(!rendered.length)return{x:0,y:0,width:Number(exercise.canvas.width)||650,height:Number(exercise.canvas.height)||400};const xs=rendered.map(element=>Number(element.metrics?.x)||0),ys=rendered.map(element=>Number(element.metrics?.y)||0),rights=rendered.map(element=>(Number(element.metrics?.x)||0)+(Number(element.metrics?.width)||40)),bottoms=rendered.map(element=>(Number(element.metrics?.y)||0)+(Number(element.metrics?.height)||32)),pad=12,x=Math.max(0,Math.min(...xs)-pad),y=Math.max(0,Math.min(...ys)-pad);return{x,y,width:Math.max(120,Math.max(...rights)-x+pad),height:Math.max(80,Math.max(...bottoms)-y+pad)};}

function renderElement(element,answer){
  if(element.type==='association_draggable'||(element.type==='linkable'&&element.linkable_type!=='source'))return null;
  const node=document.createElement('div'),m=element.metrics||{};node.className=`canvas-element canvas-${element.type}`;node.style.cssText=`left:${Number(m.x)||0}px;top:${Number(m.y)||0}px;width:${Number(m.width)||40}px;height:${Number(m.height)||32}px;font-size:${Number(element.text_format?.size)||18}px;text-align:${element.text_format?.align||'left'}`;
  if(element.type==='label')node.innerHTML=cleanHtml(element.text||'');
  else if(['input','word_inputs'].includes(element.type))node.innerHTML=`<input class="canvas-input" disabled value="${escapeHtml(answer??'')}">`;
  else if(element.type==='checkbox')node.innerHTML=`<input class="canvas-check" type="checkbox" disabled ${answer?'checked':''}>`;
  else if(element.type==='dropdown_menu')node.innerHTML=`<select class="canvas-select" disabled><option>${escapeHtml(answer??'Aucune réponse')}</option></select>`;
  else if(element.type==='association_droppable'){const values=Array.isArray(answer)?answer:[answer];node.innerHTML=`<div class="association-choice">${values.filter(Boolean).map(id=>escapeHtml((element.choices||[]).find(choice=>choice.id===id)?.text||id)).join('<br>')||'Aucune réponse'}</div>`;}
  else if(element.type==='linkable'){const choice=(element.choices||[]).find(item=>item.id===answer);node.style.height='auto';node.innerHTML=`<div class="association-choice">${escapeHtml(element.text||'')}</div><div class="canvas-select">→ ${escapeHtml(choice?.text||'Aucune réponse')}</div>`;}
  else if(element.type==='words_highlight'){const selected=new Set((answer||[]).map(String));node.classList.add('highlight-text');(element.words_list||[]).forEach((word,index)=>{const span=document.createElement('span');span.textContent=word.text;if(selected.has(String(index)))span.className='highlight-word selected';node.append(span);});}
  else if(element.type==='sorted_items'){const items=Array.isArray(answer)&&answer.length?answer:element.items||[];node.innerHTML=`<ol class="sort-list">${items.map(text=>`<li class="sort-item"><span>${escapeHtml(text)}</span></li>`).join('')}</ol>`;}
  else if(element.type==='table'){const table=document.createElement('table');table.className='canvas-table';for(let r=0;r<Number(element.table_nb_rows||0);r++){const tr=document.createElement('tr');for(let c=0;c<Number(element.table_nb_cols||0);c++){const data=(element.table_cells||[]).find(cell=>+cell.cell_row===r&&+cell.cell_col===c)||{},td=document.createElement(data.cell_is_header?'th':'td');td.innerHTML=cleanHtml(data.text||'');tr.append(td);}table.append(tr);}node.append(table);}
  else if(element.type==='image'){const img=document.createElement('img');img.src=element.image?.src||'';img.alt=element.image?.alt||'';img.style.cssText='width:100%;height:100%;object-fit:contain';node.append(img);}
  else return null;return node;
}

function cleanHtml(value){const doc=new DOMParser().parseFromString(String(value),'text/html');for(const element of [...doc.body.querySelectorAll('*')]){if(!['P','BR','B','STRONG','I','EM','U','SPAN','FONT','SUB','SUP','UL','OL','LI'].includes(element.tagName))element.replaceWith(...element.childNodes);else[...element.attributes].forEach(attribute=>element.removeAttribute(attribute.name));}return doc.body.innerHTML;}
