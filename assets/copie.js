import { api, escapeHtml, formatDate, requireBootstrap } from './api.js?v=20260831-2';
import { applyCanvasTemplate } from './canvas-templates.js?v=20260831-2';

const params=new URLSearchParams(location.search);
const email=params.get('email');
const assignmentId=params.get('assignment');
const list=document.querySelector('#copy-list');
const loading=document.querySelector('#loading');
if(loading) loading.innerHTML='<span class="loading-spinner" aria-hidden="true"></span><span>Chargement en cours…</span>';
let refreshTimer;
let copyLoading = false;
let lastSignature = '';
const matrixCache = new Map();

try{
  await requireBootstrap('enseignant');
  await loadCopy();
  refreshTimer=setInterval(()=>{if(!document.hidden)loadCopy(true);},3000);
}catch(error){loading.textContent=error.message;}

async function loadCopy(silent=false){
  if(copyLoading) return;
  copyLoading = true;
  try{
    const copy=await api('studentCopy',{email,assignmentId},{silent});
    document.querySelector('#student-name').textContent=copy.student.name;
    document.querySelector('#copy-title').textContent=`${copy.assignment.title} · Groupe ${(copy.student.groups||[]).join(', ')}`;
    const completed=copy.remises.filter(item=>item.status!=='en_cours');
    const earned=completed.reduce((sum,item)=>sum+item.score,0),total=completed.reduce((sum,item)=>sum+item.total,0),working=copy.remises.filter(item=>item.status==='en_cours').length;
    document.querySelector('#copy-summary').innerHTML=`<div class="copy-live-summary"><span class="live-kicker"><i></i> Actualisation automatique</span>${total?`<span class="result-pill ${earned/total>=.6?'result-ok':'result-help'}">${earned}/${total} · ${Math.round(earned/total*100)} %</span>`:''}${working?`<span class="status-pill status-working"><i></i> ${working} en cours</span>`:''}</div>`;
    const signature=JSON.stringify(copy.remises||[]);
    if(silent && signature===lastSignature) return;
    lastSignature=signature;
    list.innerHTML='';
    await Promise.all((copy.remises||[]).map(remise=>loadMatrix(remise.matrixId)));
    for(const remise of copy.remises||[])await renderRemise(remise);
    loading.hidden=copy.remises.length>0;
    if(!copy.remises.length){loading.hidden=false;loading.textContent='Cet élève n’a pas encore ouvert d’exercice pour cette affectation.';}
  }catch(error){if(!silent)throw error;}
  finally{copyLoading=false;}
}

async function renderRemise(remise){
  const matrix=await loadMatrix(remise.matrixId);
  const exercise=matrix.exercises.find(item=>String(item.id)===String(remise.exerciseId));if(!exercise)return;
  const answers=remise.answers||{},details=remise.details||{};
  const draft=remise.status==='en_cours',card=document.createElement('article');card.className=`exercise-card copy-card ${draft?'copy-live-card':''}`;
  card.innerHTML=`<div class="copy-card-heading"><div><span class="exercise-number">${escapeHtml(exercise.displayLabel||remise.exerciseLabel||'Activité')}</span><div class="instruction">${cleanHtml(exercise.title||'')}</div></div><div>${draft?`<span class="status-pill status-working"><i></i> En cours · ${remise.answered||0}/${remise.total||0}</span>`:`<span class="result-pill ${remise.percentage>=60?'result-ok':'result-help'}">${remise.score}/${remise.total} · ${remise.percentage} %</span>`}<small>${escapeHtml(formatDate(remise.timestamp))}</small></div></div><div class="canvas-viewport"><div class="exercise-canvas"></div></div>`;
  list.append(card);
  const canvas=card.querySelector('.exercise-canvas'),viewport=card.querySelector('.canvas-viewport');canvas.style.width=`${exercise.canvas.width||650}px`;canvas.style.height=`${exercise.canvas.height||400}px`;
  for(const element of [...(exercise.canvas.elements||[])].sort((a,b)=>Number(a.metrics?.zindex||0)-Number(b.metrics?.zindex||0))){const node=renderElement(element,answers[element.id]);if(!node)continue;if(Object.hasOwn(details,element.id))node.classList.add(details[element.id]?'correct':'incorrect');canvas.append(node);}
  layoutCanvas(canvas);const fit=()=>{const bounds=dynamicBounds(exercise,canvas),available=Math.max(viewport.clientWidth-24,240),wideTable=window.matchMedia?.('(max-width: 700px)').matches&&(exercise.canvas.elements||[]).some(element=>element.type==='table'),scale=wideTable?Math.min(1,Math.max(.78,available/bounds.width)):Math.min(1,available/bounds.width),left=Math.max(12,(viewport.clientWidth-bounds.width*scale)/2);canvas.style.width=`${bounds.width}px`;canvas.style.height=`${bounds.height}px`;canvas.style.transform=`translate(${left}px,12px) scale(${scale}) translate(${-bounds.x}px,${-bounds.y}px)`;viewport.classList.toggle('canvas-wide',wideTable&&bounds.width*scale>available);viewport.style.height=`${bounds.height*scale+24}px`;};fit();new ResizeObserver(fit).observe(viewport);
}

async function loadMatrix(id){
  const key=String(id||'');
  if(matrixCache.has(key)) return matrixCache.get(key);
  const response=await fetch(`data/matrices/${encodeURIComponent(key)}.json`);
  if(!response.ok) throw new Error('Cette activité est introuvable.');
  const matrix=await response.json();
  matrixCache.set(key,matrix);
  return matrix;
}

function contentBounds(exercise){const rendered=(exercise.canvas.elements||[]).filter(element=>element.type!=='association_draggable'&&!(element.type==='linkable'&&element.linkable_type!=='source'));if(!rendered.length)return{x:0,y:0,width:Number(exercise.canvas.width)||650,height:Number(exercise.canvas.height)||400};const xs=rendered.map(element=>Number(element.metrics?.x)||0),ys=rendered.map(element=>Number(element.metrics?.y)||0),rights=rendered.map(element=>(Number(element.metrics?.x)||0)+(Number(element.metrics?.width)||40)),bottoms=rendered.map(element=>(Number(element.metrics?.y)||0)+(Number(element.metrics?.height)||32)),pad=12,x=Math.max(0,Math.min(...xs)-pad),y=Math.max(0,Math.min(...ys)-pad);return{x,y,width:Math.max(120,Math.max(...rights)-x+pad),height:Math.max(80,Math.max(...bottoms)-y+pad)};}

function renderElement(element,answer){
  if(element.type==='association_draggable'||(element.type==='linkable'&&element.linkable_type!=='source'))return null;
  const node=document.createElement('div'),m=element.metrics||{},left=Number(m.x)||0,top=Number(m.y)||0,width=Number(m.width)||40,height=Number(m.height)||32,touchHeight=window.matchMedia?.('(max-width: 700px)').matches&&/input|word_inputs|dropdown_menu|checkbox/.test(element.type)?Math.max(height,44):height;node.className=`canvas-element canvas-${element.type}`;node.dataset.widgetId=element.id;node.dataset.baseLeft=String(left);node.dataset.baseTop=String(top);node.dataset.baseWidth=String(width);node.dataset.baseHeight=String(touchHeight);node.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${touchHeight}px;font-size:${Number(element.text_format?.size)||18}px;text-align:${element.text_format?.align||'left'}`;
  if(element.type==='label'){node.innerHTML=cleanHtml(element.text||'');const fontSize=String(element.text||'').match(/<font[^>]*\bsize=["']?(\d+)/i);if(fontSize)node.style.fontSize=`${fontSize[1]}px`;const accentCount=(String(element.text||'').match(/<font[^>]*\bcolor=["']?#ff8c00/gi)||[]).length;if(accentCount)[...node.querySelectorAll('font')].filter(font=>!font.querySelector('font')).slice(0,accentCount).forEach(font=>font.dataset.accent='1');if((Number(element.metrics?.height)||32)<=32&&!node.querySelector('br'))node.style.whiteSpace='nowrap';}
  else if(['input','word_inputs'].includes(element.type)){const input=document.createElement('input');input.className='canvas-input';input.disabled=true;input.value=answer??'';node.append(input);resizeInputNode(node,input);}
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

function cleanHtml(value){const doc=new DOMParser().parseFromString(String(value),'text/html');for(const element of [...doc.body.querySelectorAll('*')]){if(!['P','BR','B','STRONG','I','EM','U','SPAN','FONT','SUB','SUP','UL','OL','LI'].includes(element.tagName))element.replaceWith(...element.childNodes);else{const accent=element.tagName==='FONT'?(element.getAttribute('color')||'').toLowerCase():'';[...element.attributes].forEach(attribute=>element.removeAttribute(attribute.name));if(accent==='#ff8c00'||accent==='orange')element.dataset.accent='1';}}return doc.body.innerHTML;}

function resizeInputNode(node,input){const baseWidth=Number(node.dataset.baseWidth)||120,value=input.value||'',measure=document.createElement('span'),style=getComputedStyle(input);measure.className='input-measure';measure.textContent=value||'Réponse';measure.style.font=style.font;measure.style.letterSpacing=style.letterSpacing;document.body.append(measure);const desired=Math.min(360,Math.max(baseWidth,measure.getBoundingClientRect().width+28));measure.remove();node.dataset.dynamicWidth=String(desired);node.style.width=`${desired}px`;}
function layoutCanvas(root){
  const nodes=[...root.querySelectorAll('.canvas-element')],fields=nodes.filter(node=>node.classList.contains('canvas-input')||node.classList.contains('canvas-word_inputs')||node.classList.contains('canvas-dropdown_menu')||node.classList.contains('canvas-association_droppable')||node.classList.contains('canvas-checkbox'));
  const template=applyCanvasTemplate(root,nodes,fields);
  for(const label of nodes.filter(node=>template.name==='bloc-multiligne'&&node.classList.contains('canvas-label')&&node.querySelector('br'))){label.style.height='auto';label.style.whiteSpace='nowrap';}
  if(template.splitPlaceholders) for(const label of nodes.filter(node=>node.classList.contains('canvas-label')&&!node.dataset.placeholderSplit&&!node.querySelector('br'))){
    const raw=label.textContent||'',matches=[...raw.matchAll(/[\s\u00a0]{2,}/gu)],labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelWidth=Number(label.dataset.baseWidth)||40,labelHeight=Number(label.dataset.baseHeight)||32;
    const related=fields.filter(field=>{const left=Number(field.dataset.baseLeft)||0,top=Number(field.dataset.baseTop)||0,width=Number(field.dataset.baseWidth)||40,height=Number(field.dataset.baseHeight)||32;return Math.min(left+width,labelLeft+labelWidth)-Math.max(left,labelLeft)>0&&Math.min(top+height,labelTop+labelHeight)-Math.max(top,labelTop)>Math.min(height,labelHeight)*.35;}).sort((a,b)=>{const dy=(Number(a.dataset.baseTop)||0)-(Number(b.dataset.baseTop)||0);return Math.abs(dy)<12?(Number(a.dataset.baseLeft)||0)-(Number(b.dataset.baseLeft)||0):dy;});
    if(matches.length&&matches.length>=related.length)splitPlaceholderLabel(label,raw,matches,related);
  }
  for(const label of nodes.filter(node=>node.dataset.placeholderSplit))reflowPlaceholderLabel(label,nodes);
  if(template.alignTrailing) for(const label of nodes.filter(node=>node.classList.contains('canvas-label')&&!node.dataset.placeholderSplit&&!node.querySelector('br')&&!node.querySelector('font')))alignTrailingField(label,fields);
  for(const field of fields){const anchored=field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1',left=anchored?Number(field.dataset.dynamicLeft)||0:Math.max(Number(field.dataset.baseLeft)||0,Number(field.dataset.dynamicLeft)||0),top=anchored?Number(field.dataset.dynamicTop)||0:Math.max(Number(field.dataset.baseTop)||0,Number(field.dataset.dynamicTop)||0),width=Math.max(Number(field.dataset.baseWidth)||40,Number(field.dataset.dynamicWidth)||0);field.style.left=`${left}px`;field.style.top=`${top}px`;field.style.width=`${width}px`;}
  if(template.separateText){hideOverlappingAccents(nodes,fields);separateFieldsFromText(root,nodes,fields);}
  separateOverlappingFields(root,fields);
  for(const field of fields){const anchored=field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1',left=anchored?Number(field.dataset.dynamicLeft)||0:Math.max(Number(field.dataset.baseLeft)||0,Number(field.dataset.dynamicLeft)||0),baseWidth=Number(field.dataset.baseWidth)||40,right=left+(Number(field.dataset.dynamicWidth)||baseWidth),top=anchored?Number(field.dataset.dynamicTop)||0:Math.max(Number(field.dataset.baseTop)||0,Number(field.dataset.dynamicTop)||0),height=Number(field.dataset.baseHeight)||32;for(const other of nodes){if(other===field||!other.classList.contains('canvas-label'))continue;const otherLeft=Number(other.dataset.baseLeft)||0,otherTop=Number(other.dataset.baseTop)||0,otherHeight=Number(other.dataset.baseHeight)||32,sameRow=Math.min(top+height,otherTop+otherHeight)-Math.max(top,otherTop)>Math.min(height,otherHeight)*.35,originalLeft=Number(field.dataset.baseLeft)||0;if(sameRow&&otherLeft>=originalLeft+baseWidth-4)other.style.left=`${Math.max(otherLeft,right+8)}px`;}}}
 function splitPlaceholderLabel(label,raw,matches,fields){const labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelHeight=Number(label.dataset.baseHeight)||32;label.dataset.placeholderSplit='1';label.dataset.placeholderFields=fields.map(field=>field.dataset.widgetId||'').join('|');label.innerHTML='';label.style.width='max-content';label.style.whiteSpace='nowrap';const parts=raw.split(/[\s\u00a0]{2,}/gu);for(const part of parts){const span=document.createElement('span');span.className='canvas-label-part';span.textContent=part.trim();span.style.position='absolute';span.style.top='0';label.append(span);}reflowPlaceholderLabel(label,[...label.parentElement.querySelectorAll('.canvas-element')]);fields.forEach(field=>{field.dataset.placeholderAligned='1';field.dataset.dynamicTop=String(labelTop+(labelHeight-(Number(field.dataset.baseHeight)||32))/2);});}
 function reflowPlaceholderLabel(label,nodes){const ids=(label.dataset.placeholderFields||'').split('|').filter(Boolean),fields=ids.map(id=>nodes.find(node=>node.dataset.widgetId===id)).filter(Boolean),parts=[...label.querySelectorAll('.canvas-label-part')],labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0;let cursor=0;parts.forEach((part,index)=>{part.style.left=`${cursor}px`;cursor+=part.offsetWidth;if(index<fields.length){const field=fields[index],width=Number(field.dataset.dynamicWidth)||Number(field.dataset.baseWidth)||40;field.dataset.dynamicLeft=String(labelLeft+cursor+8);field.dataset.dynamicTop=String(labelTop+(Number(label.dataset.baseHeight)||32-(Number(field.dataset.baseHeight)||32))/2);cursor+=width+16;}});label.style.width=`${Math.max(Number(label.dataset.baseWidth)||40,cursor)}px`;}
 function alignTrailingField(label,fields){const labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelWidth=Number(label.dataset.baseWidth)||40,labelHeight=Number(label.dataset.baseHeight)||32,related=fields.filter(field=>{if(field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1')return false;const m=field.dataset,left=Number(m.baseLeft)||0,top=Number(m.baseTop)||0,width=Number(m.baseWidth)||40,height=Number(m.baseHeight)||32;return left<labelLeft+labelWidth+12&&left+width>labelLeft&&Math.min(top+height,labelTop+labelHeight)-Math.max(top,labelTop)>Math.min(height,labelHeight)*.35;});if(related.length!==1)return;const field=related[0],labelRect=label.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);const textRect=range.getBoundingClientRect(),scale=label.offsetWidth?labelRect.width/label.offsetWidth:1,textRight=labelLeft+Math.max(0,(textRect.right-labelRect.left)/scale),fieldLeft=Number(field.dataset.baseLeft)||0;if(textRight<=labelLeft+8||fieldLeft>=textRight+6)return;field.dataset.placeholderAligned='1';field.dataset.dynamicLeft=String(textRight+8);field.dataset.dynamicTop=String(labelTop+(labelHeight-(Number(field.dataset.baseHeight)||32))/2);}
function hideOverlappingAccents(nodes,fields){for(const label of nodes.filter(node=>node.classList.contains('canvas-label'))){for(const target of label.querySelectorAll('font[data-accent]')){const tr=target.getBoundingClientRect();if(!tr.width||!tr.height)continue;const overlaps=fields.some(field=>{const fr=field.getBoundingClientRect(),ix=Math.min(fr.right,tr.right)-Math.max(fr.left,tr.left),iy=Math.min(fr.bottom,tr.bottom)-Math.max(fr.top,tr.top);return ix>3&&iy>3&&ix>tr.width*.15&&iy>Math.min(fr.height,tr.height)*.2;});if(overlaps)target.style.visibility='hidden';}}}
 function separateFieldsFromText(root,nodes,fields){const canvasRect=root.getBoundingClientRect(),textRects=label=>{const rects=[],walk=node=>{for(const child of node.childNodes||[]){if(child.nodeType===3&&child.textContent.trim()){const range=document.createRange();range.selectNodeContents(child);for(const rect of range.getClientRects())if(rect.width&&rect.height)rects.push(rect);}else if(child.nodeType===1&&getComputedStyle(child).visibility!=='hidden')walk(child);}};walk(label);return rects;};for(const field of fields){for(let pass=0;pass<4;pass++){const fr=field.getBoundingClientRect(),collisions=[];for(const label of nodes.filter(node=>node.classList.contains('canvas-label')))for(const tr of textRects(label)){const ix=Math.min(fr.right,tr.right)-Math.max(fr.left,tr.left),iy=Math.min(fr.bottom,tr.bottom)-Math.max(fr.top,tr.top);if(ix>3&&iy>3)collisions.push(tr);}if(!collisions.length)break;const nextTop=Math.max(...collisions.map(rect=>rect.bottom-canvasRect.top))+6,currentTop=Number(field.style.top)||0;if(nextTop<=currentTop+1)break;field.style.top=`${nextTop}px`;field.dataset.dynamicTop=String(nextTop);}}}
 function separateOverlappingFields(root,fields){const rootRect=root.getBoundingClientRect();for(let pass=0;pass<3;pass++){let changed=false;for(let index=0;index<fields.length;index++){const first=fields[index],firstRect=first.getBoundingClientRect();for(let next=index+1;next<fields.length;next++){const second=fields[next],secondRect=second.getBoundingClientRect(),ix=Math.min(firstRect.right,secondRect.right)-Math.max(firstRect.left,secondRect.left),iy=Math.min(firstRect.bottom,secondRect.bottom)-Math.max(firstRect.top,secondRect.top);if(ix<=Math.min(firstRect.width,secondRect.width)*.35||iy<=3)continue;const [upper,lower]=firstRect.top<=secondRect.top?[first,second]:[second,first],upperRect=upper===first?firstRect:secondRect,nextTop=upperRect.bottom-rootRect.top+6,currentTop=Number(lower.style.top)||0;if(nextTop>currentTop+1){lower.style.top=`${nextTop}px`;lower.dataset.dynamicTop=String(nextTop);changed=true;}}}if(!changed)break;}}
function dynamicBounds(exercise,root){const base=contentBounds(exercise),nodes=[...root.querySelectorAll('.canvas-element')];if(!nodes.length)return base;const xs=nodes.map(node=>parseFloat(node.style.left)||0),ys=nodes.map(node=>parseFloat(node.style.top)||0),rights=nodes.map(node=>(parseFloat(node.style.left)||0)+Math.max(node.offsetWidth||0,node.scrollWidth||0,parseFloat(node.style.width)||40)),bottoms=nodes.map(node=>(parseFloat(node.style.top)||0)+(node.offsetHeight||parseFloat(node.style.height)||32)),pad=12,x=Math.max(0,Math.min(base.x,Math.min(...xs)-pad)),y=Math.max(0,Math.min(base.y,Math.min(...ys)-pad));return{x,y,width:Math.max(base.width,Math.max(...rights)-x+pad),height:Math.max(base.height,Math.max(...bottoms)-y+pad)};}
