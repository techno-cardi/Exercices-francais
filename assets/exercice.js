import { api, escapeHtml, requireBootstrap } from './api.js';

const params = new URLSearchParams(location.search);
const assignmentId = params.get('assignment');
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

document.querySelector('#previous').addEventListener('click', () => { if (current > 0) { current -= 1; renderExercise(); } });
document.querySelector('#next').addEventListener('click', goNext);
document.querySelector('#submit').addEventListener('click', submitExercise);
window.addEventListener('resize', fitCanvas);

try {
  const data = await requireBootstrap('eleve');
  assignment = (data.assignments || []).find(item => String(item.id) === String(assignmentId));
  if (!assignment) throw new Error('Cette activité ne t’est pas assignée.');
  matrixId ||= assignment.matrixIds?.[0];
  if (!assignment.matrixIds?.map(String).includes(String(matrixId))) throw new Error('Cette partie ne fait pas partie de ton activité.');
  matrix = await fetch(`data/matrices/${encodeURIComponent(matrixId)}.json`).then(response => {
    if (!response.ok) throw new Error('Cette activité est introuvable.');
    return response.json();
  });
  const allowed = new Set((assignment.exerciseIds || []).map(String));
  exercises = matrix.exercises.filter(item => !allowed.size || allowed.has(String(item.id)));
  if (!exercises.length) throw new Error('Aucun exercice n’est disponible ici.');
  document.querySelector('#preview-banner').hidden = !data.preview;
  document.querySelector('#assignment-title').textContent = assignment.title;
  document.querySelector('#assignment-mode').textContent = assignment.mode === 'evaluation' ? 'Évaluation' : 'Activité formative';
  document.querySelector('#matrix-title').textContent = matrix.label;
  loading.hidden = true;
  card.hidden = false;
  renderExercise();
} catch (error) {
  loading.textContent = error.message;
}

function renderExercise() {
  const exercise = exercises[current];
  answers = {};
  feedback.hidden = true;
  feedback.className = 'exercise-feedback';
  document.querySelector('#exercise-number').textContent = `Exercice ${current + 1}`;
  document.querySelector('#instruction').innerHTML = cleanHtml(exercise.title || '<p>Complète l’exercice.</p>');
  const percentage = Math.round((current / exercises.length) * 100);
  document.querySelector('#progress-copy').textContent = `${current + 1} sur ${exercises.length}`;
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
  fitCanvas();
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

  if (element.type === 'label') node.innerHTML = cleanHtml(element.text || '');
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
  node.style.left = `${Number(metrics.x) || 0}px`;
  node.style.top = `${Number(metrics.y) || 0}px`;
  node.style.width = `${Number(metrics.width) || 40}px`;
  node.style.height = `${Number(metrics.height) || 32}px`;
}

function addInput(node, element) {
  const input = document.createElement('input');
  input.className = 'canvas-input';
  input.type = 'text';
  input.setAttribute('aria-label', 'Ta réponse');
  input.addEventListener('input', () => { answers[element.id] = input.value; });
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
  select.addEventListener('change', () => { answers[element.id] = select.multiple ? [...select.selectedOptions].map(option => option.value) : select.value; });
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
    answers[element.id] = input.checked;
  });
  node.append(input);
}

function addLinkable(node, element) {
  const label = document.createElement('div'); label.className = 'association-choice'; label.textContent = element.text || '';
  const select = document.createElement('select'); select.className = 'canvas-select'; select.innerHTML = `<option value="">Relier à…</option>${(element.choices || []).map(choice => `<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.text)}</option>`).join('')}`;
  select.addEventListener('change', () => { answers[element.id] = select.value; });
  node.style.height = 'auto'; node.append(label, select);
}

function addHighlights(node, element) {
  node.classList.add('highlight-text'); const selected = [];
  (element.words_list || []).forEach((word, index) => {
    if (!String(word.text).trim()) { node.append(document.createTextNode(word.text)); return; }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'highlight-word'; button.textContent = word.text;
    button.addEventListener('click', () => { selected[index] = !selected[index]; button.classList.toggle('selected', selected[index]); answers[element.id] = selected.map((active, wordIndex) => active ? String(wordIndex) : null).filter(value => value !== null); });
    node.append(button);
  });
}

function addSorter(node, element) {
  const list = document.createElement('ol'); list.className = 'sort-list'; let items = [...(element.items || [])];
  const draw = () => { answers[element.id] = items; list.innerHTML = items.map((text,index) => `<li class="sort-item"><span>${escapeHtml(text)}</span><button type="button" data-up="${index}" aria-label="Monter">↑</button><button type="button" data-down="${index}" aria-label="Descendre">↓</button></li>`).join(''); };
  list.addEventListener('click', event => { const up=event.target.dataset.up, down=event.target.dataset.down; const index=Number(up ?? down); if (!Number.isInteger(index)) return; const target=up!==undefined?index-1:index+1; if(target<0||target>=items.length)return; [items[index],items[target]]=[items[target],items[index]]; draw(); });
  node.append(list); draw();
}

function addTable(node, element) {
  const table=document.createElement('table'); table.className='canvas-table'; const cells=element.table_cells||[];
  for(let row=0;row<Number(element.table_nb_rows||0);row++){const tr=document.createElement('tr');for(let col=0;col<Number(element.table_nb_cols||0);col++){const data=cells.find(cell=>Number(cell.cell_row)===row&&Number(cell.cell_col)===col)||{};const cell=document.createElement(data.cell_is_header?'th':'td');cell.innerHTML=cleanHtml(data.text||'');tr.append(cell)}table.append(tr)}node.append(table);
}

function addImage(node, element) { const src=element.image?.src; if(!src)return; const img=document.createElement('img');img.src=src;img.alt=element.image.alt||'';img.style.cssText='width:100%;height:100%;object-fit:contain';node.append(img); }

async function submitExercise() {
  const button=document.querySelector('#submit'); button.disabled=true; feedback.hidden=false; feedback.className='exercise-feedback'; feedback.textContent='Vérification en cours…';
  try { const result=await api('grade',{assignmentId:assignment.id,matrixId:matrix.id,exerciseId:exercises[current].id,exerciseLabel:`Exercice ${current+1} · ${matrix.label}`,answers}); feedback.textContent=result.message || (assignment.mode==='evaluation'?'Tes réponses sont enregistrées.':`${result.score} réponse${result.score>1?'s':''} réussie${result.score>1?'s':''} sur ${result.total}.`); for(const detail of result.details||[]){const node=canvas.querySelector(`[data-widget-id="${CSS.escape(detail.id)}"]`);node?.classList.add(detail.correct?'correct':'incorrect')} document.querySelector('#submit').hidden=true;document.querySelector('#next').hidden=false;document.querySelector('#progress-bar').style.width=`${Math.round((current+1)/exercises.length*100)}%`; }
  catch(error){feedback.className='exercise-feedback error';feedback.textContent=error.message}
  finally{button.disabled=false}
}

function goNext(){ if(current<exercises.length-1){current+=1;renderExercise();return} const matrices=assignment.matrixIds||[];const index=matrices.map(String).indexOf(String(matrix.id));if(index>=0&&index<matrices.length-1){location.href=`exercice.html?assignment=${encodeURIComponent(assignment.id)}&matrix=${encodeURIComponent(matrices[index+1])}`;return}location.href='eleve.html'; }

function fitCanvas(){const exercise=exercises[current];if(!exercise)return;const width=Number(exercise.canvas.width)||650,height=Number(exercise.canvas.height)||400,scale=Math.min(1,viewport.clientWidth/width);canvas.style.transform=`scale(${scale})`;viewport.style.height=`${height*scale}px`;}

function cleanHtml(value){const doc=new DOMParser().parseFromString(String(value),'text/html');for(const element of [...doc.body.querySelectorAll('*')]){if(!['P','BR','B','STRONG','I','EM','U','SPAN','FONT','SUB','SUP','UL','OL','LI'].includes(element.tagName))element.replaceWith(...element.childNodes);else [...element.attributes].forEach(attribute=>element.removeAttribute(attribute.name));}return doc.body.innerHTML;}
