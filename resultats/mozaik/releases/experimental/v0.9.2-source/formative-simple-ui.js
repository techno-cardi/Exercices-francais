(() => {
  if (window.__cardinalFormativeSimple092) return;
  window.__cardinalFormativeSimple092 = true;

  const formativeId = location.pathname.match(/\/formatives\/([^/]+)\/results/)?.[1] || '';
  if (!formativeId) return;

  const HOST_ID = 'cardinal-formative-simple-092';
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.all = 'initial';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode:'open' });

  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .launcher{position:fixed;right:18px;bottom:18px;z-index:2147483646;display:flex;gap:8px;align-items:center}
      button{border:0;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer;font-size:13px}
      button.primary{background:#132a4a;color:#fff;box-shadow:0 8px 24px rgba(15,35,64,.24)}
      button.secondary{background:#fff;color:#132a4a;border:1px solid #cad5e4;box-shadow:0 5px 16px rgba(15,35,64,.12)}
      button:disabled{opacity:.5;cursor:wait}
      .modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:18px}
      .hidden{display:none!important}
      .card{width:min(840px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.25);color:#172033}
      .head{padding:18px 20px 14px;border-bottom:1px solid #e7ecf3;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .head h2{font-size:19px;margin:2px 0}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#66758a;font-weight:800}
      .body{padding:18px 20px;display:grid;gap:14px}.actions{padding:14px 20px 18px;border-top:1px solid #e7ecf3;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
      label{font-size:12px;font-weight:750;color:#40516a;display:grid;gap:6px}.select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;background:#fff;color:#172033}
      .notice{border:1px solid #dbe4f0;background:#f7f9fc;border-radius:12px;padding:11px 12px;font-size:13px;line-height:1.45;white-space:pre-wrap}
      .notice.ok{border-color:#b7e4cb;background:#f2fbf6}.notice.warn{border-color:#f0d7a6;background:#fff9ed}.notice.err{border-color:#efb8b8;background:#fff5f5;color:#8e2424}
      .summary{display:flex;gap:8px;flex-wrap:wrap}.pill{border-radius:999px;padding:6px 9px;background:#edf2f8;font-size:12px;font-weight:700;color:#415269}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:8px 7px;border-bottom:1px solid #e8edf4;vertical-align:top}th{position:sticky;top:0;background:#fff;color:#526278}.grade{white-space:nowrap;font-weight:750}.comment{max-width:360px;white-space:pre-wrap}
      .switches{display:flex;gap:18px;flex-wrap:wrap;font-size:13px}.switches label{display:flex;align-items:center;gap:7px;font-weight:650;color:#27364a}
      .close{background:transparent;color:#526278;padding:5px 8px;font-size:20px}
      .small{font-size:12px;color:#68778b;line-height:1.4}
      .detected{font-size:12px;color:#315070;font-weight:650}
    </style>
    <div class="launcher">
      <button id="correctBtn" class="primary">Corriger avec ChatGPT</button>
      <button id="gestionBtn" class="secondary">Résultat global → Gestion</button>
    </div>

    <div id="chooseModal" class="modal hidden">
      <div class="card">
        <div class="head"><div><div class="eyebrow">Correction assistée</div><h2>Choisir la question</h2></div><button class="close" data-close="chooseModal">×</button></div>
        <div class="body">
          <div id="detectedText" class="detected"></div>
          <label>Classe<select id="sectionSelect" class="select"></select></label>
          <label>Question<select id="questionSelect" class="select"></select></label>
          <div class="notice">L’extension détecte automatiquement la classe et la question ouvertes dans Formative quand elles sont présentes dans l’URL. Tu peux simplement confirmer.</div>
          <div id="chooseStatus" class="notice hidden"></div>
        </div>
        <div class="actions"><button class="secondary" data-close="chooseModal">Annuler</button><button id="copyOpenBtn" class="primary">Copier et ouvrir ChatGPT</button></div>
      </div>
    </div>

    <div id="previewModal" class="modal hidden">
      <div class="card">
        <div class="head"><div><div class="eyebrow">Retour de ChatGPT</div><h2 id="previewTitle">Vérifier avant publication</h2></div><button class="close" data-close="previewModal">×</button></div>
        <div class="body">
          <div id="previewSummary" class="summary"></div>
          <div id="previewWarning" class="notice warn hidden"></div>
          <div class="switches">
            <label><input id="publishNotes" type="checkbox" checked> Publier les notes</label>
            <label><input id="publishComments" type="checkbox"> Publier les commentaires</label>
          </div>
          <div style="overflow:auto;max-height:52vh"><table><thead><tr><th></th><th>Élève</th><th>Ancienne</th><th>Nouvelle</th><th>Commentaire</th></tr></thead><tbody id="previewRows"></tbody></table></div>
          <div id="publishStatus" class="notice hidden"></div>
        </div>
        <div class="actions"><button class="secondary" data-close="previewModal">Annuler</button><button id="publishBtn" class="primary">Publier dans Formative</button></div>
      </div>
    </div>

    <div id="statusModal" class="modal hidden">
      <div class="card" style="width:min(520px,94vw)">
        <div class="head"><div><div class="eyebrow">Cardinal</div><h2 id="statusTitle">Traitement</h2></div><button class="close" data-close="statusModal">×</button></div>
        <div class="body"><div id="statusText" class="notice"></div></div>
        <div class="actions"><button class="primary" data-close="statusModal">Fermer</button></div>
      </div>
    </div>`;

  const $ = id => root.getElementById(id);
  let catalog = null;
  let pendingPreview = null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function fmt(v){if(v===null||v===undefined||v==='')return '-';const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-CA',{maximumFractionDigits:2}):String(v);}
  function params(){const u=new URL(location.href);return{assignmentId:u.searchParams.get('selectedAssignmentId')||'',questionId:u.searchParams.get('selectedFormativeItemId')||''};}
  function request(action,payload={}){return chrome.runtime.sendMessage({type:'FORMATIVE_REQUEST',action,payload});}
  async function copyText(text){
    try { await navigator.clipboard.writeText(String(text||'')); return true; } catch {}
    try {
      const ta=document.createElement('textarea');
      ta.value=String(text||'');ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';
      document.documentElement.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);
      const ok=document.execCommand('copy');ta.remove();if(ok)return true;
    } catch {}
    return false;
  }
  function close(id){$(id)?.classList.add('hidden');}
  function open(id){$(id)?.classList.remove('hidden');}
  root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(b.dataset.close)));

  function showStatus(title,text,kind=''){
    $('statusTitle').textContent=title;$('statusText').textContent=text;$('statusText').className=`notice ${kind}`;open('statusModal');
  }

  async function loadCatalog(){
    const r=await request('aiSectionsV2',{formativeId});
    if(!r?.ok)throw new Error(r?.message||'Impossible de lire Formative.');
    catalog=r;return r;
  }

  function pickSection(cat){
    const p=params();
    return (cat.sections||[]).find(x=>String(x.assignmentId)===String(p.assignmentId)) || ((cat.sections||[]).length===1?cat.sections[0]:null);
  }
  function pickQuestion(cat){
    const p=params();
    return (cat.questions||[]).find(x=>String(x.id)===String(p.questionId)) || ((cat.questions||[]).length===1?cat.questions[0]:null);
  }

  function fillChooser(cat){
    const ps=pickSection(cat),pq=pickQuestion(cat);
    $('sectionSelect').innerHTML=(cat.sections||[]).map(x=>`<option value="${esc(x.assignmentId)}" data-section="${esc(x.sectionId)}">${esc(x.title)}${x.studentCount?` (${x.studentCount} élèves)`:''}</option>`).join('');
    if(ps)$('sectionSelect').value=ps.assignmentId;
    $('questionSelect').innerHTML=(cat.questions||[]).map(q=>`<option value="${esc(q.id)}">Q${esc(q.number||'?')} · ${esc(q.label||'Question')} · /${esc(fmt(q.possiblePoints))}</option>`).join('');
    if(pq)$('questionSelect').value=pq.id;
    const detected=[];if(ps)detected.push(`Classe détectée : ${ps.title}`);if(pq)detected.push(`Question détectée : Q${pq.number||'?'}`);
    $('detectedText').textContent=detected.length?detected.join(' · '):'Aucune sélection unique détectée, choisis simplement ci-dessous.';
  }

  function buildPrompt(ctx){
    const q=ctx.question;
    const lines=[];
    lines.push('Je veux corriger cette question avec toi. Tu peux me proposer une correction, puis je pourrai te donner un barème, des exemples, ou te demander d’ajuster certaines notes avant de finaliser.');
    lines.push('');
    lines.push(`Évaluation : ${ctx.title}`);
    lines.push(`Classe : ${ctx.sectionTitle}`);
    lines.push(`Question ${q.number||''} sur ${fmt(q.possiblePoints)} points`);
    lines.push(q.text||'');
    lines.push('');
    lines.push('RÉPONSES DES ÉLÈVES');
    lines.push('');
    for(const a of q.answers){
      if(!a.answerText||a.hasMedia)continue;
      lines.push(`Élève : ${a.studentName}`);
      lines.push(`Réponse : ${a.answerText}`);
      lines.push('');
    }
    lines.push('INSTRUCTION POUR LE RETOUR VERS FORMATIVE');
    lines.push('Dès que tu proposes ou modifies des notes, termine chacune de tes réponses de correction par un tableau Markdown complet avec exactement ces colonnes : Élève | Note | Commentaire. Je ne dois pas avoir à te redemander un format importable.');
    lines.push(`La note doit être numérique sur ${fmt(q.possiblePoints)}. Garde le nom de chaque élève exactement comme il est écrit ci-dessus. Le commentaire peut rester vide si je ne demande pas de commentaires.`);
    lines.push('Si je te demande ensuite de réviser, d’être plus sévère, d’appliquer un barème, de te baser sur des exemples ou de changer certaines notes, réévalue ce qui est pertinent et renvoie à nouveau le tableau complet révisé à la fin.');
    lines.push('Ne mets jamais une note à un élève dont la réponse est absente de la liste.');
    return lines.join('\n');
  }

  async function prepareAndCopy(){
    $('copyOpenBtn').disabled=true;$('chooseStatus').classList.add('hidden');
    try{
      if(!catalog)await loadCatalog();
      const assignmentId=$('sectionSelect').value;const sec=(catalog.sections||[]).find(x=>String(x.assignmentId)===String(assignmentId));
      const questionId=$('questionSelect').value;const qMeta=(catalog.questions||[]).find(x=>String(x.id)===String(questionId));
      if(!sec||!qMeta)throw new Error('Choisis une classe et une question.');
      let prepared;
      let notePublishingBlocked=false;
      let r=await request('aiPrepareV2',{formativeId,assignmentId:sec.assignmentId,sectionId:sec.sectionId,questionIds:[questionId],mode:'notes'});
      if(!r?.ok){
        const fallback=await request('aiPrepareV2',{formativeId,assignmentId:sec.assignmentId,sectionId:sec.sectionId,questionIds:[questionId],mode:'comments'});
        if(!fallback?.ok)throw new Error(r?.message||fallback?.message||'Impossible de préparer cette question.');
        prepared=fallback;notePublishingBlocked=true;
      }else prepared=r;
      const q=(prepared.questions||[]).find(x=>String(x.id)===String(questionId));
      if(!q)throw new Error('La question sélectionnée n’a pas pu être relue.');
      const usable=(q.answers||[]).filter(a=>a.answerText&&!a.hasMedia&&a.studentName);
      if(!usable.length)throw new Error('Aucune réponse textuelle exploitable n’a été trouvée pour cette question.');
      const ctx={
        version:'CARDINAL_SIMPLE_V092',createdAt:Date.now(),sessionId:crypto.randomUUID(),formativeId,title:prepared.title,
        assignmentId:prepared.assignmentId,sectionId:prepared.sectionId,sectionTitle:prepared.sectionTitle,groupCode:prepared.groupCode,
        notePublishingBlocked,
        question:{...q,answers:usable}
      };
      const prompt=buildPrompt(ctx);
      if(!await copyText(prompt))throw new Error('Je n’ai pas réussi à copier les réponses. Réessaie après avoir autorisé le presse-papiers pour Formative.');
      const sr=await chrome.runtime.sendMessage({type:'CARDINAL_SAVE_SIMPLE_CONTEXT',context:ctx});
      if(!sr?.ok)throw new Error(sr?.message||'Impossible de mémoriser la question.');
      close('chooseModal');
      const openResult=await chrome.runtime.sendMessage({type:'CARDINAL_OPEN_CHATGPT'});
      if(!openResult?.ok)showStatus('Réponses copiées','Les réponses sont dans le presse-papiers. Ouvre ChatGPT et colle-les.','ok');
    }catch(e){$('chooseStatus').textContent=e?.message||String(e);$('chooseStatus').className='notice err';$('chooseStatus').classList.remove('hidden');}
    finally{$('copyOpenBtn').disabled=false;}
  }

  async function openCorrection(){
    const b=$('correctBtn');b.disabled=true;
    try{const c=await loadCatalog();fillChooser(c);open('chooseModal');}
    catch(e){showStatus('Formative',e?.message||String(e),'err');}
    finally{b.disabled=false;}
  }

  function renderPreview(preview){
    pendingPreview=preview;
    const q=preview.context?.question||{};
    $('previewTitle').textContent=`Q${q.number||'?'} · vérifier avant publication`;
    const rows=preview.rows||[];
    const notes=rows.filter(r=>r.points!==null&&r.points!==undefined).length;
    const comments=rows.filter(r=>String(r.comment||'').trim()).length;
    $('previewSummary').innerHTML=`<span class="pill">${rows.length} élève${rows.length===1?'':'s'} reconnu${rows.length===1?'':'s'}</span><span class="pill">${notes} note${notes===1?'':'s'}</span><span class="pill">${comments} commentaire${comments===1?'':'s'}</span>`;
    const problems=[];
    if(preview.unmatched?.length)problems.push(`${preview.unmatched.length} nom${preview.unmatched.length===1?' non reconnu':'s non reconnus'} : ${preview.unmatched.slice(0,6).join(', ')}`);
    if(preview.ambiguous?.length)problems.push(`${preview.ambiguous.length} correspondance${preview.ambiguous.length===1?' ambiguë':'s ambiguës'} : ${preview.ambiguous.slice(0,6).join(', ')}`);
    if(preview.invalid?.length)problems.push(`${preview.invalid.length} ligne${preview.invalid.length===1?' invalide':'s invalides'} : ${preview.invalid.slice(0,4).join(', ')}`);
    $('previewWarning').textContent=problems.join('\n');$('previewWarning').classList.toggle('hidden',!problems.length);
    $('publishNotes').checked=notes>0&&!preview.context?.notePublishingBlocked;$('publishNotes').disabled=!!preview.context?.notePublishingBlocked||!notes;
    $('publishComments').checked=false;$('publishComments').disabled=!comments;
    $('previewRows').innerHTML=rows.map((r,i)=>`<tr><td><input type="checkbox" class="rowCheck" data-index="${i}" checked></td><td>${esc(r.studentName)}</td><td class="grade">${esc(fmt(r.originalPoints))}</td><td class="grade">${r.points===null||r.points===undefined?'-':`${esc(fmt(r.points))} / ${esc(fmt(r.possiblePoints))}`}</td><td class="comment">${esc(r.comment||'')}</td></tr>`).join('');
    $('publishStatus').classList.add('hidden');open('previewModal');
  }

  async function publishPreview(){
    if(!pendingPreview)return;
    const publishNotes=$('publishNotes').checked,publishComments=$('publishComments').checked;
    if(!publishNotes&&!publishComments){$('publishStatus').textContent='Choisis Notes, Commentaires, ou les deux.';$('publishStatus').className='notice err';$('publishStatus').classList.remove('hidden');return;}
    const selected=new Set([...root.querySelectorAll('.rowCheck:checked')].map(x=>Number(x.dataset.index)));
    const corrections=(pendingPreview.rows||[]).filter((_,i)=>selected.has(i)).map(r=>({...r,publishNote:publishNotes&&r.points!==null&&r.points!==undefined,publishComment:publishComments&&!!String(r.comment||'').trim()}));
    if(!corrections.length)return;
    const b=$('publishBtn');b.disabled=true;$('publishStatus').textContent='Vérification de Formative avant écriture…';$('publishStatus').className='notice';$('publishStatus').classList.remove('hidden');
    try{
      const c=pendingPreview.context;
      const r=await request('aiPublishV2',{sessionId:c.sessionId,formativeId:c.formativeId,assignmentId:c.assignmentId,sectionId:c.sectionId,groupCode:c.groupCode,corrections,publishNotes,publishComments,copyCommentsToGestion:false});
      if(!r?.ok||!r.publishOk){const msg=(r?.errors||[]).slice(0,6).map(x=>x.message).join('\n')||r?.message||'Publication bloquée.';throw new Error(msg);}
      $('publishStatus').textContent=`Terminé : ${r.notesUpdated||0} note${Number(r.notesUpdated||0)===1?'':'s'} mise${Number(r.notesUpdated||0)===1?'':'s'} à jour${r.notesAlready?`, ${r.notesAlready} déjà correcte${r.notesAlready===1?'':'s'}`:''}${publishComments?` · ${r.commentsAdded||0} commentaire${Number(r.commentsAdded||0)===1?'':'s'} ajouté${Number(r.commentsAdded||0)===1?'':'s'}`:''}.`;
      $('publishStatus').className='notice ok';
    }catch(e){$('publishStatus').textContent=e?.message||String(e);$('publishStatus').className='notice err';}
    finally{b.disabled=false;}
  }

  async function sendGlobal(){
    const b=$('gestionBtn');b.disabled=true;
    try{
      const c=await loadCatalog();const p=params();let sec=(c.sections||[]).find(x=>String(x.assignmentId)===String(p.assignmentId))||((c.sections||[]).length===1?c.sections[0]:null);
      if(!sec){fillChooser(c);open('chooseModal');throw new Error('Choisis d’abord la classe dans Formative, puis relance « Résultat global → Gestion ».');}
      const r=await request('sendGlobalToGestionV3',{formativeId,assignmentId:sec.assignmentId,sectionId:sec.sectionId});
      if(!r?.ok)throw new Error(r?.message||'Impossible de transmettre les résultats.');
      showStatus('Gestion des notes',`${sec.title} : ${r.studentCount||0} élève${Number(r.studentCount||0)===1?'':'s'} transmis. Gestion des notes s’ouvre avec toutes les questions présélectionnées pour former un seul résultat global.`,'ok');
    }catch(e){showStatus('Gestion des notes',e?.message||String(e),'err');}
    finally{b.disabled=false;}
  }

  $('correctBtn').addEventListener('click',openCorrection);
  $('copyOpenBtn').addEventListener('click',prepareAndCopy);
  $('publishBtn').addEventListener('click',publishPreview);
  $('gestionBtn').addEventListener('click',sendGlobal);

  chrome.runtime.onMessage.addListener(message=>{
    if(message?.type==='CARDINAL_SIMPLE_IMPORT_PREVIEW'&&message.preview){renderPreview(message.preview);return;}
    if(message?.type==='CARDINAL_FORMATIVE_UI'&&message.message){ if(message.status==='error')showStatus(message.title||'Formative',message.message,'err'); }
  });

  chrome.storage.local.get('cardinal_simple_pending_preview_v092').then(o=>{
    const p=o?.cardinal_simple_pending_preview_v092;
    if(p?.context?.formativeId===formativeId)renderPreview(p);
  }).catch(()=>{});
})();
