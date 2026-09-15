(() => {
  const $ = id => document.getElementById(id);
  $('version').textContent = `v${chrome.runtime.getManifest().version}`;

  function setStatus(text, kind='') {
    $('status').textContent = text || '';
    $('status').className = `notice ${kind}`;
  }

  function button(label, cls, onClick) {
    const b=document.createElement('button');
    b.className=`btn ${cls}`;b.textContent=label;b.addEventListener('click',onClick);return b;
  }

  async function activeTab() {
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    return tabs[0]||null;
  }

  async function send(tabId, type) {
    try { return await chrome.tabs.sendMessage(tabId,{type}); }
    catch (error) { throw new Error('Recharge la page une fois pour activer Cardinal, puis réessaie.'); }
  }

  async function render() {
    const tab=await activeTab();
    const url=String(tab?.url||'');
    $('actions').innerHTML='';
    if (/^https:\/\/app\.formative\.com\/formatives\/[^/]+\/results/i.test(url)) {
      $('pageTitle').textContent='Formative';
      const u=new URL(url);const q=u.searchParams.get('selectedFormativeItemId');const a=u.searchParams.get('selectedAssignmentId');
      $('pageMeta').textContent = q ? 'Une question est actuellement sélectionnée.' : 'Ouvre la question que tu veux corriger, ou choisis-la après.';
      $('actions').append(
        button('Préparer une correction','primary',async e=>{
          const b=e.currentTarget;b.disabled=true;setStatus('Lecture de la classe et des questions…');
          try{const r=await send(tab.id,'CARDINAL_SIMPLE_OPEN_CORRECTION');if(r?.ok===false)throw new Error(r.message||'Impossible d’ouvrir la correction.');window.close();}catch(err){setStatus(err.message||String(err),'err');b.disabled=false;}
        }),
        button('Envoyer le résultat global dans Gestion','secondary',async e=>{
          const b=e.currentTarget;b.disabled=true;setStatus('Préparation du résultat global…');
          try{const r=await send(tab.id,'CARDINAL_SIMPLE_SEND_GLOBAL');if(r?.ok===false)throw new Error(r.message||'Impossible de préparer le résultat global.');window.close();}catch(err){setStatus(err.message||String(err),'err');b.disabled=false;}
        })
      );
      setStatus('Aucun bouton Cardinal n’est affiché dans Formative tant que tu n’ouvres pas ce menu.','ok');
      return;
    }
    if (/^https:\/\/techno-cardi\.github\.io\/Exercices-francais\/resultats/i.test(url)) {
      $('pageTitle').textContent='Gestion des notes';$('pageMeta').textContent='La synchronisation Mozaïk et les imports Formative sont disponibles directement dans la plateforme.';setStatus('Détection automatique Mozaïk active en arrière-plan.','ok');return;
    }
    if (/^https:\/\/mozaikportail\.ca\//i.test(url)) {
      $('pageTitle').textContent='Mozaïk';$('pageMeta').textContent='Cardinal apprend automatiquement les groupes, les matières et les listes officielles quand Mozaïk les charge.';setStatus('Aucun bouton supplémentaire n’est ajouté à la page.','ok');return;
    }
    if (/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(url)) {
      $('pageTitle').textContent='Correction';$('pageMeta').textContent='Quand une correction Formative est en cours, Cardinal peut renvoyer le tableau final vers Formative.';setStatus('Utilise le bouton de retour affiché seulement quand une correction est prête.','ok');return;
    }
    $('pageTitle').textContent='Cardinal';$('pageMeta').textContent='Ouvre Formative, Gestion des notes ou Mozaïk pour utiliser les fonctions automatiques.';setStatus('');
  }

  render().catch(e=>setStatus(e?.message||String(e),'err'));
})();
