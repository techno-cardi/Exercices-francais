import { api, escapeHtml, requireBootstrap } from './api.js?v=20260831-2';
import { applyCanvasTemplate } from './canvas-templates.js?v=20260831-2';

const params = new URLSearchParams(location.search);
const assignmentId = params.get('assignment');
const teacherPreview = params.get('apercu-enseignant') === '1';
let matrixId = params.get('matrix');
const card = document.querySelector('#exercise-card');
const canvas = document.querySelector('#exercise-canvas');
const viewport = document.querySelector('#canvas-viewport');
const feedback = document.querySelector('#feedback');
const loading = document.querySelector('#loading');
let assignment;
let matrix;
let exercises = [];
let current = 0;
let answers = {};
let saveTimer;
let syncEnabled = false;

document.querySelector('#previous').addEventListener('click', () => { if (current > 0) { current -= 1; renderExercise(); } });
document.querySelector('#next').addEventListener('click', goNext);
document.querySelector('#submit').addEventListener('click', submitExercise);
window.addEventListener('resize', fitCanvas);

try {
  const data = await requireBootstrap(teacherPreview ? 'enseignant' : 'eleve');
  if (teacherPreview) {
    if (!matrixId) throw new Error('Choisis un exercice à prévisualiser.');
    const exerciseId = params.get('exercise');
    assignment = { id:'apercu-enseignant', title:params.get('title') || 'Aperçu enseignant', mode:params.get('mode') === 'evaluation' ? 'evaluation' : 'formatif', matrixIds:[matrixId], exerciseIds:exerciseId ? [exerciseId] : [] };
    document.querySelector('#brand-link').href = 'enseignant.html';
    document.querySelector('#back-link').href = 'enseignant.html';
    document.querySelector('#back-link').textContent = '← Espace enseignant';
    document.querySelector('#submit').textContent = 'Continuer l’aperçu';
  } else {
    assignment = (data.assignments || []).find(item => String(item.id) === String(assignmentId));
    if (!assignment) throw new Error('Cette activité ne t’est pas assignée.');
    matrixId ||= assignment.matrixIds?.[0];
  }
  if (!assignment.matrixIds?.map(String).includes(String(matrixId))) throw new Error('Cette partie ne fait pas partie de ton activité.');
  matrix = await fetch(`data/matrices/${encodeURIComponent(matrixId)}.json`).then(response => {
    if (!response.ok) throw new Error('Cette activité est introuvable.');
    return response.json();
  });
  const allowed = new Set((assignment.exerciseIds || []).map(String));
  exercises = matrix.exercises.filter(item => !allowed.size || allowed.has(String(item.id)));
  if (!exercises.length) throw new Error('Aucun exercice n’est disponible ici.');
  document.querySelector('#preview-banner').hidden = !data.preview && !teacherPreview;
  if (teacherPreview) document.querySelector('#preview-banner').textContent = 'Aperçu enseignant : tu vois exactement l’écran présenté aux élèves. Rien n’est enregistré.';
  document.querySelector('#assignment-title').textContent = assignment.title;
  document.querySelector('#assignment-mode').textContent = assignment.mode === 'evaluation' ? 'Évaluation' : 'Activité formative';
  document.querySelector('#matrix-title').textContent = matrix.displayLabel || matrix.label;
  loading.hidden = true;
  card.hidden = false;
  syncEnabled = !data.preview && !teacherPreview;
  renderExercise();
} catch (error) {
  loading.textContent = error.message;
}

function renderExercise() {
  const exercise = exercises[current];
  answers = {};
  feedback.hidden = true;
  feedback.className = 'exercise-feedback';
  document.querySelector('#exercise-number').textContent = `Question ${exercise.number || `${matrix.number || ''}.${current + 1}`}`;
  document.querySelector('#instruction').innerHTML = cleanHtml(exercise.title || '<p>Complète l’exercice.</p>');
  const percentage = Math.round((current / exercises.length) * 100);
  document.querySelector('#progress-copy').textContent = `Question ${current + 1} sur ${exercises.length}`;
  document.querySelector('#progress-bar').style.width = `${percentage}%`;
  document.querySelector('#previous').disabled = current === 0;
  document.querySelector('#submit').hidden = false;
  document.querySelector('#next').hidden = true;
  canvas.innerHTML = '';
  canvas.style.width = `${Number(exercise.canvas.width) || 650}px`;
  canvas.style.height = `${Number(exercise.canvas.height) || 400}px`;
  for (const element of [...(exercise.canvas.elements || [])].sort((a,b) => Number(a.metrics?.zindex || 0) - Number(b.metrics?.zindex || 0))) {
    const node = renderElement(element);
    if (node) canvas.append(node);
  }
  layoutCanvas();
  fitCanvas();
  scheduleDraftSave(250);
}

function renderElement(element) {
  if (element.type === 'association_draggable' || (element.type === 'linkable' && element.linkable_type !== 'source')) return null;
  const node = document.createElement('div');
  node.className = `canvas-element canvas-${element.type}`;
  node.dataset.widgetId = element.id;
  position(node, element.metrics || {});
  const size = Number(element.text_format?.size);
  if (size) node.style.fontSize = `${size}px`;
  if (element.text_format?.align) node.style.textAlign = element.text_format.align;

  if (element.type === 'label') {
    node.innerHTML = cleanHtml(element.text || '');
    const fontSize = String(element.text || '').match(/<font[^>]*\bsize=["']?(\d+)/i);
    if (fontSize) node.style.fontSize = `${fontSize[1]}px`;
    const accentCount = (String(element.text || '').match(/<font[^>]*\bcolor=["']?#ff8c00/gi) || []).length;
    if (accentCount) [...node.querySelectorAll('font')].filter(font => !font.querySelector('font')).slice(0, accentCount).forEach(font => font.dataset.accent = '1');
    if ((Number(element.metrics?.height) || 32) <= 32 && !node.querySelector('br')) node.style.whiteSpace = 'nowrap';
  }
  else if (element.type === 'input' || element.type === 'word_inputs') addInput(node, element);
  else if (element.type === 'dropdown_menu') addSelect(node, element, (element.options || []).map(text => ({ id:text, text })));
  else if (element.type === 'checkbox') addCheckbox(node, element);
  else if (element.type === 'association_droppable') addSelect(node, element, element.choices || [], true);
  else if (element.type === 'linkable') addLinkable(node, element);
  else if (element.type === 'words_highlight') addHighlights(node, element);
  else if (element.type === 'sorted_items') addSorter(node, element);
  else if (element.type === 'table') addTable(node, element);
  else if (element.type === 'image') addImage(node, element);
  else return null;
  return node;
}

function position(node, metrics) {
  const left = Number(metrics.x) || 0;
  const top = Number(metrics.y) || 0;
  const width = Number(metrics.width) || 40;
  const height = Number(metrics.height) || 32;
  const touchHeight = window.matchMedia?.('(max-width: 700px)').matches && /canvas-(input|word_inputs|dropdown_menu|checkbox)/.test(node.className) ? Math.max(height, 44) : height;
  node.dataset.baseLeft = String(left);
  node.dataset.baseTop = String(top);
  node.dataset.baseWidth = String(width);
  node.dataset.baseHeight = String(touchHeight);
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.width = `${width}px`;
  node.style.height = `${touchHeight}px`;
}

function addInput(node, element) {
  const input = document.createElement('input');
  input.className = 'canvas-input';
  input.type = 'text';
  input.setAttribute('aria-label', 'Ta réponse');
  input.addEventListener('input', () => {
    setAnswer(element.id, input.value);
    resizeInputNode(node, input);
    layoutCanvas();
    fitCanvas();
  });
  node.append(input);
}

function addSelect(node, element, choices, multiple = false) {
  const select = document.createElement('select');
  select.className = 'canvas-select';
  select.setAttribute('aria-label', 'Choisis une réponse');
  select.innerHTML = `<option value="">Choisir…</option>${choices.map(choice => `<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.text)}</option>`).join('')}`;
  if (multiple && Number(element.droppable_count) > 1) {
    select.multiple = true;
    select.size = Math.min(Number(element.droppable_count), choices.length, 4);
  }
  select.addEventListener('change', () => setAnswer(element.id, select.multiple ? [...select.selectedOptions].map(option => option.value) : select.value));
  node.append(select);
}

function addCheckbox(node, element) {
  const input = document.createElement('input');
  input.type = 'checkbox'; input.className = 'canvas-check'; input.setAttribute('aria-label', 'Cocher cette réponse');
  if (element.group) input.dataset.group = element.group;
  input.addEventListener('change', () => {
    if (input.checked && element.group) {
      canvas.querySelectorAll(`.canvas-check[data-group="${CSS.escape(String(element.group))}"]`).forEach(other => {
        if (other === input) return;
        other.checked = false;
        const otherId = other.closest('[data-widget-id]')?.dataset.widgetId;
        if (otherId) answers[otherId] = false;
      });
    }
    setAnswer(element.id, input.checked);
  });
  node.append(input);
}

function addLinkable(node, element) {
  const label = document.createElement('div'); label.className = 'association-choice'; label.textContent = element.text || '';
  const select = document.createElement('select'); select.className = 'canvas-select'; select.innerHTML = `<option value="">Relier à…</option>${(element.choices || []).map(choice => `<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.text)}</option>`).join('')}`;
  select.addEventListener('change', () => setAnswer(element.id, select.value));
  node.style.height = 'auto'; node.append(label, select);
}

function addHighlights(node, element) {
  node.classList.add('highlight-text'); const selected = [];
  (element.words_list || []).forEach((word, index) => {
    if (!String(word.text).trim()) { node.append(document.createTextNode(word.text)); return; }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'highlight-word'; button.textContent = word.text;
    button.addEventListener('click', () => { selected[index] = !selected[index]; button.classList.toggle('selected', selected[index]); setAnswer(element.id, selected.map((active, wordIndex) => active ? String(wordIndex) : null).filter(value => value !== null)); });
    node.append(button);
  });
}

function addSorter(node, element) {
  const list = document.createElement('ol'); list.className = 'sort-list'; let items = [...(element.items || [])];
  const draw = changed => { answers[element.id] = items; list.innerHTML = items.map((text,index) => `<li class="sort-item"><span>${escapeHtml(text)}</span><button type="button" data-up="${index}" aria-label="Monter">↑</button><button type="button" data-down="${index}" aria-label="Descendre">↓</button></li>`).join(''); if(changed)scheduleDraftSave(); };
  list.addEventListener('click', event => { const up=event.target.dataset.up, down=event.target.dataset.down; const index=Number(up ?? down); if (!Number.isInteger(index)) return; const target=up!==undefined?index-1:index+1; if(target<0||target>=items.length)return; [items[index],items[target]]=[items[target],items[index]]; draw(true); });
  node.append(list); draw(false);
}

function addTable(node, element) {
  const table=document.createElement('table'); table.className='canvas-table'; const cells=element.table_cells||[];
  for(let row=0;row<Number(element.table_nb_rows||0);row++){const tr=document.createElement('tr');for(let col=0;col<Number(element.table_nb_cols||0);col++){const data=cells.find(cell=>Number(cell.cell_row)===row&&Number(cell.cell_col)===col)||{};const cell=document.createElement(data.cell_is_header?'th':'td');cell.innerHTML=cleanHtml(data.text||'');tr.append(cell)}table.append(tr)}node.append(table);
}

function addImage(node, element) { const src=element.image?.src; if(!src)return; const img=document.createElement('img');img.src=src;img.alt=element.image.alt||'';img.style.cssText='width:100%;height:100%;object-fit:contain';node.append(img); }

async function submitExercise() {
  const button=document.querySelector('#submit'); button.disabled=true; feedback.hidden=false; feedback.className='exercise-feedback'; feedback.innerHTML='<span class="loading-indicator"><span class="loading-spinner" aria-hidden="true"></span><span>Vérification en cours…</span></span>';
  if(teacherPreview){feedback.textContent='Aperçu seulement : aucune réponse n’a été enregistrée.';button.hidden=true;document.querySelector('#next').hidden=false;button.disabled=false;return;}
  clearTimeout(saveTimer);
  try { const exercise=exercises[current],result=await api('grade',{assignmentId:assignment.id,matrixId:matrix.id,exerciseId:exercise.id,exerciseLabel:exercise.displayLabel||`Activité ${exercise.number||current+1} — ${matrix.label}`,answers}); feedback.textContent=result.message || (assignment.mode==='evaluation'?'Tes réponses sont enregistrées.':`${result.score} réponse${result.score>1?'s':''} réussie${result.score>1?'s':''} sur ${result.total}.`); for(const detail of result.details||[]){const node=canvas.querySelector(`[data-widget-id="${CSS.escape(detail.id)}"]`);if(node){node.classList.remove('correct','incorrect');node.classList.add(detail.correct?'correct':'incorrect')}} document.querySelector('#submit').hidden=true;document.querySelector('#next').hidden=false;document.querySelector('#progress-bar').style.width=`${Math.round((current+1)/exercises.length*100)}%`; }
  catch(error){feedback.className='exercise-feedback error';feedback.textContent=error.message}
  finally{button.disabled=false}
}

function goNext(){ if(current<exercises.length-1){current+=1;renderExercise();return} if(teacherPreview){location.href='enseignant.html';return} const matrices=assignment.matrixIds||[];const index=matrices.map(String).indexOf(String(matrix.id));if(index>=0&&index<matrices.length-1){location.href=`exercice.html?assignment=${encodeURIComponent(assignment.id)}&matrix=${encodeURIComponent(matrices[index+1])}`;return}location.href='eleve.html'; }

function setAnswer(id,value){answers[id]=value;scheduleDraftSave();}
function scheduleDraftSave(delay=650){if(!syncEnabled)return;clearTimeout(saveTimer);document.querySelector('#save-status').textContent='Enregistrement…';saveTimer=setTimeout(saveDraft,delay);}
async function saveDraft(){
  if(!syncEnabled)return;const exercise=exercises[current],snapshot=JSON.parse(JSON.stringify(answers));
  try{await api('saveDraft',{assignmentId:assignment.id,matrixId:matrix.id,exerciseId:exercise.id,exerciseLabel:exercise.displayLabel||`Activité ${exercise.number||current+1} — ${matrix.label}`,answers:snapshot,total:answerableCount(exercise)},{silent:true});document.querySelector('#save-status').textContent='Réponses enregistrées';}
  catch{document.querySelector('#save-status').textContent='Sauvegarde en attente';}
}
function answerableCount(exercise){const types=new Set(['input','word_inputs','dropdown_menu','checkbox','association_droppable','linkable','words_highlight','sorted_items']);return (exercise.canvas.elements||[]).filter(element=>types.has(element.type)&&(element.type!=='linkable'||element.linkable_type==='source')).length;}

function fitCanvas(){const exercise=exercises[current];if(!exercise)return;const bounds=dynamicBounds(exercise,canvas),available=Math.max(viewport.clientWidth-24,240),wideTable=window.matchMedia?.('(max-width: 700px)').matches&&(exercise.canvas.elements||[]).some(element=>element.type==='table'),scale=wideTable?Math.min(1,Math.max(.78,available/bounds.width)):Math.min(1,available/bounds.width),left=Math.max(12,(viewport.clientWidth-bounds.width*scale)/2);canvas.style.width=`${bounds.width}px`;canvas.style.height=`${bounds.height}px`;canvas.style.transform=`translate(${left}px,12px) scale(${scale}) translate(${-bounds.x}px,${-bounds.y}px)`;viewport.classList.toggle('canvas-wide',wideTable&&bounds.width*scale>available);viewport.style.height=`${bounds.height*scale+24}px`;}
function resizeInputNode(node,input){
  const baseWidth=Number(node.dataset.baseWidth)||120;
  const value=input.value||'';
  const measure=document.createElement('span');
  const style=getComputedStyle(input);
  measure.className='input-measure';
  measure.textContent=value||'Réponse';
  measure.style.font=style.font;
  measure.style.letterSpacing=style.letterSpacing;
  document.body.append(measure);
  const desired=Math.min(360,Math.max(baseWidth,measure.getBoundingClientRect().width+28));
  measure.remove();
  node.dataset.dynamicWidth=String(desired);
  node.style.width=`${desired}px`;
}
function layoutCanvas(){
  const nodes=[...canvas.querySelectorAll('.canvas-element')];
  const fields=nodes.filter(node=>node.classList.contains('canvas-input')||node.classList.contains('canvas-word_inputs')||node.classList.contains('canvas-dropdown_menu')||node.classList.contains('canvas-association_droppable')||node.classList.contains('canvas-checkbox'));
  const template=applyCanvasTemplate(canvas,nodes,fields);
  for(const label of nodes.filter(node=>template.name==='bloc-multiligne'&&node.classList.contains('canvas-label')&&node.querySelector('br'))){label.style.height='auto';label.style.whiteSpace='nowrap';}
  if(template.splitPlaceholders) for(const label of nodes.filter(node=>node.classList.contains('canvas-label')&&!node.dataset.placeholderSplit&&!node.querySelector('br'))){
    const raw=label.textContent||'',matches=[...raw.matchAll(/[\s\u00a0]{2,}/gu)];
    const labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelWidth=Number(label.dataset.baseWidth)||40,labelHeight=Number(label.dataset.baseHeight)||32;
    const related=fields.filter(field=>{const left=Number(field.dataset.baseLeft)||0,top=Number(field.dataset.baseTop)||0,width=Number(field.dataset.baseWidth)||40,height=Number(field.dataset.baseHeight)||32;return Math.min(left+width,labelLeft+labelWidth)-Math.max(left,labelLeft)>0&&Math.min(top+height,labelTop+labelHeight)-Math.max(top,labelTop)>Math.min(height,labelHeight)*.35;}).sort((a,b)=>{const dy=(Number(a.dataset.baseTop)||0)-(Number(b.dataset.baseTop)||0);return Math.abs(dy)<12?(Number(a.dataset.baseLeft)||0)-(Number(b.dataset.baseLeft)||0):dy;});
    if(matches.length&&matches.length>=related.length)splitPlaceholderLabel(label,raw,matches,related);
  }
  if(template.alignTrailing) for(const label of nodes.filter(node=>node.classList.contains('canvas-label')&&!node.dataset.placeholderSplit&&!node.querySelector('br')&&!node.querySelector('font')))alignTrailingField(label,fields);
  fields.forEach(field=>{
    const anchored=field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1';
    const left=anchored?Number(field.dataset.dynamicLeft)||0:Math.max(Number(field.dataset.baseLeft)||0,Number(field.dataset.dynamicLeft)||0);
    const top=anchored?Number(field.dataset.dynamicTop)||0:Math.max(Number(field.dataset.baseTop)||0,Number(field.dataset.dynamicTop)||0);
    const width=Math.max(Number(field.dataset.baseWidth)||40,Number(field.dataset.dynamicWidth)||0);
    field.style.left=`${left}px`;
    field.style.top=`${top}px`;
    field.style.width=`${width}px`;
  });
  for(const label of nodes.filter(node=>node.dataset.placeholderSplit))reflowPlaceholderLabel(label,nodes);
  for(const field of fields){
    const left=field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1'?Number(field.dataset.dynamicLeft)||0:Math.max(Number(field.dataset.baseLeft)||0,Number(field.dataset.dynamicLeft)||0);
    const baseWidth=Number(field.dataset.baseWidth)||40;
    const right=left+(Number(field.dataset.dynamicWidth)||baseWidth);
    const top=field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1'?Number(field.dataset.dynamicTop)||0:Math.max(Number(field.dataset.baseTop)||0,Number(field.dataset.dynamicTop)||0);
    const height=Number(field.dataset.baseHeight)||32;
    for(const other of nodes){
      if(other===field||!other.classList.contains('canvas-label'))continue;
      const otherLeft=Number(other.dataset.baseLeft)||0;
      const otherTop=Number(other.dataset.baseTop)||0;
      const otherHeight=Number(other.dataset.baseHeight)||32;
      const sameRow=Math.min(top+height,otherTop+otherHeight)-Math.max(top,otherTop)>Math.min(height,otherHeight)*.35;
      const originalLeft=Number(field.dataset.baseLeft)||0;
      if(sameRow&&otherLeft>=originalLeft+baseWidth-4)other.style.left=`${Math.max(otherLeft,right+8)}px`;
    }
  }
  if(template.separateText){hideOverlappingAccents(nodes,fields);separateFieldsFromText(canvas,nodes,fields);}
  separateOverlappingFields(canvas,fields);
}
function splitPlaceholderLabel(label,raw,matches,fields){
  const labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelHeight=Number(label.dataset.baseHeight)||32;
  label.dataset.placeholderSplit='1';label.dataset.placeholderFields=fields.map(field=>field.dataset.widgetId||'').join('|');label.innerHTML='';label.style.width='max-content';label.style.whiteSpace='nowrap';
  const parts=raw.split(/[\s\u00a0]{2,}/gu);for(const part of parts){const span=document.createElement('span');span.className='canvas-label-part';span.textContent=part.trim();span.style.position='absolute';span.style.top='0';label.append(span);}
  reflowPlaceholderLabel(label,[...label.parentElement.querySelectorAll('.canvas-element')]);
  const fieldNodes=fields;fieldNodes.forEach(field=>{field.dataset.placeholderAligned='1';field.dataset.dynamicTop=String(labelTop+(labelHeight-(Number(field.dataset.baseHeight)||32))/2);});
}
function reflowPlaceholderLabel(label,nodes){
  const ids=(label.dataset.placeholderFields||'').split('|').filter(Boolean),fields=ids.map(id=>nodes.find(node=>node.dataset.widgetId===id)).filter(Boolean),parts=[...label.querySelectorAll('.canvas-label-part')],labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0;let cursor=0;
  parts.forEach((part,index)=>{part.style.left=`${cursor}px`;cursor+=part.offsetWidth;if(index<fields.length){const field=fields[index],width=Number(field.dataset.dynamicWidth)||Number(field.dataset.baseWidth)||40;field.dataset.dynamicLeft=String(labelLeft+cursor+8);field.dataset.dynamicTop=String(labelTop+(Number(label.dataset.baseHeight)||32-(Number(field.dataset.baseHeight)||32))/2);cursor+=width+16;}});label.style.width=`${Math.max(Number(label.dataset.baseWidth)||40,cursor)}px`;
}
function alignTrailingField(label,fields){
  const labelLeft=Number(label.dataset.baseLeft)||0,labelTop=Number(label.dataset.baseTop)||0,labelWidth=Number(label.dataset.baseWidth)||40,labelHeight=Number(label.dataset.baseHeight)||32;
  const related=fields.filter(field=>{if(field.dataset.anchorAligned==='1'||field.dataset.placeholderAligned==='1')return false;const left=Number(field.dataset.baseLeft)||0,top=Number(field.dataset.baseTop)||0,width=Number(field.dataset.baseWidth)||40,height=Number(field.dataset.baseHeight)||32;return left<labelLeft+labelWidth+12&&left+width>labelLeft&&Math.min(top+height,labelTop+labelHeight)-Math.max(top,labelTop)>Math.min(height,labelHeight)*.35;});
  if(related.length!==1)return;
  const field=related[0],labelRect=label.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);const textRect=range.getBoundingClientRect(),scale=label.offsetWidth?labelRect.width/label.offsetWidth:1,textRight=labelLeft+Math.max(0,(textRect.right-labelRect.left)/scale),fieldLeft=Number(field.dataset.baseLeft)||0;
  if(textRight<=labelLeft+8||fieldLeft>=textRight+6)return;
  field.dataset.placeholderAligned='1';field.dataset.dynamicLeft=String(textRight+8);field.dataset.dynamicTop=String(labelTop+(labelHeight-(Number(field.dataset.baseHeight)||32))/2);
}
function hideOverlappingAccents(nodes,fields){
  for(const label of nodes.filter(node=>node.classList.contains('canvas-label'))){
    for(const target of label.querySelectorAll('font[data-accent]')){
      const tr=target.getBoundingClientRect();
      if(!tr.width||!tr.height)continue;
      const overlaps=fields.some(field=>{const fr=field.getBoundingClientRect();const ix=Math.min(fr.right,tr.right)-Math.max(fr.left,tr.left),iy=Math.min(fr.bottom,tr.bottom)-Math.max(fr.top,tr.top);return ix>3&&iy>3&&ix>tr.width*.15&&iy>Math.min(fr.height,tr.height)*.2;});
      if(overlaps)target.style.visibility='hidden';
    }
  }
}
function separateFieldsFromText(root,nodes,fields){
  const canvasRect=root.getBoundingClientRect();
  const textRects=label=>{const rects=[],walk=node=>{for(const child of node.childNodes||[]){if(child.nodeType===3&&child.textContent.trim()){const range=document.createRange();range.selectNodeContents(child);for(const rect of range.getClientRects())if(rect.width&&rect.height)rects.push(rect);}else if(child.nodeType===1&&getComputedStyle(child).visibility!=='hidden')walk(child);}};walk(label);return rects;};
  for(const field of fields){
    for(let pass=0;pass<4;pass++){
      const fr=field.getBoundingClientRect();
      const collisions=[];
      for(const label of nodes.filter(node=>node.classList.contains('canvas-label')))for(const tr of textRects(label)){const ix=Math.min(fr.right,tr.right)-Math.max(fr.left,tr.left),iy=Math.min(fr.bottom,tr.bottom)-Math.max(fr.top,tr.top);if(ix>3&&iy>3)collisions.push(tr);}
      if(!collisions.length)break;
      const nextTop=Math.max(...collisions.map(rect=>rect.bottom-canvasRect.top))+6;
      const currentTop=Number(field.style.top)||0;if(nextTop<=currentTop+1)break;
      field.style.top=`${nextTop}px`;field.dataset.dynamicTop=String(nextTop);
    }
  }
}
function separateOverlappingFields(root,fields){
  const rootRect=root.getBoundingClientRect();
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(let index=0;index<fields.length;index++){
      const first=fields[index],firstRect=first.getBoundingClientRect();
      for(let next=index+1;next<fields.length;next++){
        const second=fields[next],secondRect=second.getBoundingClientRect();
        const ix=Math.min(firstRect.right,secondRect.right)-Math.max(firstRect.left,secondRect.left);
        const iy=Math.min(firstRect.bottom,secondRect.bottom)-Math.max(firstRect.top,secondRect.top);
        if(ix<=Math.min(firstRect.width,secondRect.width)*.35||iy<=3)continue;
        const [upper,lower]=firstRect.top<=secondRect.top?[first,second]:[second,first];
        const upperRect=upper===first?firstRect:secondRect;
        const nextTop=upperRect.bottom-rootRect.top+6;
        const currentTop=Number(lower.style.top)||0;
        if(nextTop>currentTop+1){lower.style.top=`${nextTop}px`;lower.dataset.dynamicTop=String(nextTop);changed=true;}
      }
    }
    if(!changed)break;
  }
}
function dynamicBounds(exercise,root){
  const base=contentBounds(exercise),nodes=[...root.querySelectorAll('.canvas-element')];
  if(!nodes.length)return base;
  const xs=nodes.map(node=>parseFloat(node.style.left)||0),ys=nodes.map(node=>parseFloat(node.style.top)||0),rights=nodes.map(node=>(parseFloat(node.style.left)||0)+Math.max(node.offsetWidth||0,node.scrollWidth||0,parseFloat(node.style.width)||40)),bottoms=nodes.map(node=>(parseFloat(node.style.top)||0)+(node.offsetHeight||parseFloat(node.style.height)||32)),pad=12;
  const x=Math.max(0,Math.min(base.x,Math.min(...xs)-pad)),y=Math.max(0,Math.min(base.y,Math.min(...ys)-pad));
  return{x,y,width:Math.max(base.width,Math.max(...rights)-x+pad),height:Math.max(base.height,Math.max(...bottoms)-y+pad)};
}
function contentBounds(exercise){const rendered=(exercise.canvas.elements||[]).filter(element=>element.type!=='association_draggable'&&!(element.type==='linkable'&&element.linkable_type!=='source'));if(!rendered.length)return{x:0,y:0,width:Number(exercise.canvas.width)||650,height:Number(exercise.canvas.height)||400};const xs=rendered.map(element=>Number(element.metrics?.x)||0),ys=rendered.map(element=>Number(element.metrics?.y)||0),rights=rendered.map(element=>(Number(element.metrics?.x)||0)+(Number(element.metrics?.width)||40)),bottoms=rendered.map(element=>(Number(element.metrics?.y)||0)+(Number(element.metrics?.height)||32)),pad=12,x=Math.max(0,Math.min(...xs)-pad),y=Math.max(0,Math.min(...ys)-pad);return{x,y,width:Math.max(120,Math.max(...rights)-x+pad),height:Math.max(80,Math.max(...bottoms)-y+pad)};}

function cleanHtml(value){const doc=new DOMParser().parseFromString(String(value),'text/html');for(const element of [...doc.body.querySelectorAll('*')]){if(!['P','BR','B','STRONG','I','EM','U','SPAN','FONT','SUB','SUP','UL','OL','LI'].includes(element.tagName))element.replaceWith(...element.childNodes);else{const accent=element.tagName==='FONT'?(element.getAttribute('color')||'').toLowerCase():'';[...element.attributes].forEach(attribute=>element.removeAttribute(attribute.name));if(accent==='#ff8c00'||accent==='orange')element.dataset.accent='1';}}return doc.body.innerHTML;}
