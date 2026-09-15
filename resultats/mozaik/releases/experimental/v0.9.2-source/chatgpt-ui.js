(() => {
  if (window.__cardinalChatGptBridge092) return;
  window.__cardinalChatGptBridge092 = true;

  const host=document.createElement('div');host.id='cardinal-chatgpt-bridge-092';host.style.all='initial';document.documentElement.appendChild(host);const root=host.attachShadow({mode:'open'});
  root.innerHTML=`
  <style>
    *{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .wrap{position:fixed;right:18px;bottom:18px;z-index:2147483647}.btn{border:0;border-radius:12px;background:#132a4a;color:#fff;padding:11px 15px;font-weight:750;cursor:pointer;box-shadow:0 8px 26px rgba(15,35,64,.28);font-size:13px}.btn:disabled{opacity:.55;cursor:wait}
    .panel{position:fixed;right:18px;bottom:68px;z-index:2147483647;width:min(440px,calc(100vw - 36px));background:#fff;color:#172033;border:1px solid #d9e1ec;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.2);padding:14px;display:grid;gap:10px}.hidden{display:none!important}.title{font-weight:800;font-size:14px}.small{font-size:12px;line-height:1.45;color:#5b6b80;white-space:pre-wrap}.ok{color:#17653a}.err{color:#9b2626}.ta{width:100%;min-height:150px;border:1px solid #cbd5e1;border-radius:10px;padding:9px;resize:vertical;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.actions{display:flex;gap:8px;justify-content:flex-end}.secondary{border:1px solid #cbd5e1;background:#fff;color:#24364f;border-radius:9px;padding:8px 11px;font-weight:700;cursor:pointer}.primary{border:0;background:#132a4a;color:#fff;border-radius:9px;padding:8px 11px;font-weight:700;cursor:pointer}
  </style>
  <div class="wrap"><button id="sendBtn" class="btn hidden">Envoyer les résultats dans Formative</button></div>
  <div id="panel" class="panel hidden"><div class="title">Résultats pour Formative</div><div id="msg" class="small"></div><textarea id="paste" class="ta hidden" placeholder="Si la détection automatique ne trouve pas le tableau, colle ici la réponse finale de ChatGPT."></textarea><div class="actions"><button id="cancel" class="secondary">Fermer</button><button id="parsePaste" class="primary hidden">Envoyer ce texte</button></div></div>`;
  const $=id=>root.getElementById(id);

  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function cleanCell(v){return String(v??'').replace(/\s+/g,' ').trim();}

  function assistantNodes(){
    const specific=[...document.querySelectorAll('[data-message-author-role="assistant"]')];
    if(specific.length)return specific;
    return [...document.querySelectorAll('article')].filter(a=>/assistant|chatgpt/i.test(a.getAttribute('data-testid')||'')||a.querySelector('[data-message-author-role="assistant"]'));
  }

  function parseTable(table){
    const headers=[...table.querySelectorAll('thead th')].map(x=>norm(x.textContent));
    let nameIdx=headers.findIndex(h=>h==='eleve'||h==='nom'||h.includes('eleve')||h.includes('student'));
    let gradeIdx=headers.findIndex(h=>h==='note'||h.includes('note')||h.includes('resultat')||h.includes('score'));
    let commentIdx=headers.findIndex(h=>h.includes('comment')||h.includes('retroaction')||h.includes('feedback'));
    const bodyRows=[...table.querySelectorAll('tbody tr')];
    if((nameIdx<0||(gradeIdx<0&&commentIdx<0))&&bodyRows.length){
      const first=[...bodyRows[0].querySelectorAll('td,th')].map(x=>norm(x.textContent));
      const ni=first.findIndex(h=>h==='eleve'||h==='nom'||h.includes('eleve')||h.includes('student'));
      const gi=first.findIndex(h=>h==='note'||h.includes('note')||h.includes('resultat')||h.includes('score'));
      const ci=first.findIndex(h=>h.includes('comment')||h.includes('retroaction')||h.includes('feedback'));
      if(ni>=0&&(gi>=0||ci>=0)){nameIdx=ni;gradeIdx=gi;commentIdx=ci;bodyRows.shift();}
    }
    if(nameIdx<0||(gradeIdx<0&&commentIdx<0))return [];
    const rows=[];
    for(const tr of bodyRows){const cells=[...tr.querySelectorAll('td,th')].map(x=>cleanCell(x.textContent));if(!cells.length)continue;const name=cells[nameIdx]||'',grade=gradeIdx>=0?(cells[gradeIdx]||''):'',comment=commentIdx>=0?(cells[commentIdx]||''):'';if(name&&(grade||comment))rows.push({name,grade,comment});}
    return rows;
  }

  function parseMarkdownText(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    for(let i=0;i<lines.length;i++){
      const line=lines[i];if(!line.includes('|'))continue;
      const h=line.replace(/^\||\|$/g,'').split('|').map(x=>norm(x));
      const nameIdx=h.findIndex(x=>x==='eleve'||x==='nom'||x.includes('eleve')||x.includes('student'));
      const gradeIdx=h.findIndex(x=>x==='note'||x.includes('note')||x.includes('resultat')||x.includes('score'));
      const commentIdx=h.findIndex(x=>x.includes('comment')||x.includes('retroaction')||x.includes('feedback'));
      if(nameIdx<0||(gradeIdx<0&&commentIdx<0))continue;
      const rows=[];
      for(let j=i+1;j<lines.length;j++){
        const l=lines[j];if(!l.includes('|')){if(rows.length)break;continue;}
        const cells=l.replace(/^\||\|$/g,'').split('|').map(cleanCell);
        if(cells.every(c=>/^:?-{2,}:?$/.test(c)))continue;
        const name=cells[nameIdx]||'',grade=gradeIdx>=0?(cells[gradeIdx]||''):'',comment=commentIdx>=0?(cells[commentIdx]||''):'';
        if(name&&(grade||comment))rows.push({name,grade,comment});
      }
      if(rows.length)return rows;
    }
    return [];
  }

  function parseLastAssistant(){
    const nodes=assistantNodes();const last=nodes[nodes.length-1];if(!last)return [];
    const tables=[...last.querySelectorAll('table')];
    for(let i=tables.length-1;i>=0;i--){const rows=parseTable(tables[i]);if(rows.length)return rows;}
    return parseMarkdownText(last.innerText||last.textContent||'');
  }

  async function contextAvailable(){
    try{const r=await chrome.runtime.sendMessage({type:'CARDINAL_GET_SIMPLE_CONTEXT'});$('sendBtn').classList.toggle('hidden',!r?.ok||!r.context);return r?.context||null;}catch{$('sendBtn').classList.add('hidden');return null;}
  }

  async function sendRows(rows,source='ChatGPT'){
    if(!rows.length)throw new Error('Aucun tableau « Élève | Note » n’a été trouvé.');
    const r=await chrome.runtime.sendMessage({type:'CARDINAL_CHATGPT_RESULTS',payload:{rows,source}});
    if(!r?.ok)throw new Error(r?.message||'Impossible de préparer l’import Formative.');
    $('msg').textContent=`${r.recognized||0} résultat${Number(r.recognized||0)===1?'':'s'} reconnu${Number(r.recognized||0)===1?'':'s'}. Formative est ouvert pour la vérification.${r.unmatched||r.ambiguous||r.invalid?`\nÀ vérifier : ${Number(r.unmatched||0)+Number(r.ambiguous||0)+Number(r.invalid||0)} ligne(s).`:''}`;$('msg').className='small ok';$('paste').classList.add('hidden');$('parsePaste').classList.add('hidden');$('panel').classList.remove('hidden');
  }

  $('sendBtn').addEventListener('click',async()=>{
    const b=$('sendBtn');b.disabled=true;$('panel').classList.remove('hidden');$('paste').classList.add('hidden');$('parsePaste').classList.add('hidden');$('msg').className='small';$('msg').textContent='Je lis le dernier tableau de correction…';
    try{const rows=parseLastAssistant();if(!rows.length){$('msg').textContent='Je n’ai pas trouvé de tableau Élève | Note dans la dernière réponse. Colle la réponse finale ci-dessous.';$('msg').className='small err';$('paste').classList.remove('hidden');$('parsePaste').classList.remove('hidden');return;}await sendRows(rows,'Dernière réponse ChatGPT');}
    catch(e){$('msg').textContent=e?.message||String(e);$('msg').className='small err';$('paste').classList.remove('hidden');$('parsePaste').classList.remove('hidden');}
    finally{b.disabled=false;}
  });

  $('parsePaste').addEventListener('click',async()=>{try{const rows=parseMarkdownText($('paste').value);await sendRows(rows,'Texte collé dans ChatGPT');}catch(e){$('msg').textContent=e?.message||String(e);$('msg').className='small err';}});
  $('cancel').addEventListener('click',()=>$('panel').classList.add('hidden'));

  contextAvailable();setInterval(contextAvailable,4000);
})();
