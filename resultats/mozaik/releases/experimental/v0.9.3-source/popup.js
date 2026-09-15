(() => {
  const $ = id => document.getElementById(id);
  $('version').textContent = `v${chrome.runtime.getManifest().version}`;

  function setStatus(text, kind='') {
    $('status').textContent = text || '';
    $('status').className = `notice ${kind}`;
  }

  function button(label, cls, onClick) {
    const b=document.createElement('button');
    b.className=`btn ${cls}`;
    b.textContent=label;
    b.addEventListener('click',onClick);
    return b;
  }

  async function activeTab() {
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    return tabs[0]||null;
  }

  async function ensureFormativeUi(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId,{type:'CARDINAL_SIMPLE_PING'});
      return;
    } catch {}
    try {
      await chrome.scripting.executeScript({
        target:{tabId},
        files:['formative-simple-ui.js','formative-stealth-v093.js']
      });
      await new Promise(r=>setTimeout(r,120));
    } catch {
      throw new Error('Impossible d’activer Cardinal sur cette page Formative. Recharge la page puis réessaie.');
    }
  }

  async function sendFormative(tabId, type) {
    try { return await chrome.tabs.sendMessage(tabId,{type}); }
    catch {}
    await ensureFormativeUi(tabId);
    try { return await chrome.tabs.sendMessage(tabId,{type}); }
    catch { throw new Error('Cardinal n’a pas pu ouvrir cette action dans Formative. Recharge la page puis réessaie.'); }
  }

  async function render() {
    const tab=await activeTab();
    const url=String(tab?.url||'');
    $('actions').innerHTML='';

    if (/^https:\/\/app\.formative\.com\/formatives\/[^/]+\/results/i.test(url)) {
      $('pageTitle').textContent='Formative';
      const u=new URL(url);
      const q=u.searchParams.get('selectedFormativeItemId');
      $('pageMeta').textContent = q ? 'Une question est actuellement sélectionnée.' : 'Ouvre la question que tu veux corriger, ou choisis-la après.';
      $('actions').append(
        button('Préparer une correction','primary',async e=>{
          const b=e.currentTarget;b.disabled=true;setStatus('Lecture de la classe et des questions…');
          try{
            const r=await sendFormative(tab.id,'CARDINAL_SIMPLE_OPEN_CORRECTION');
            if(r?.ok===false)throw new Error(r.message||'Impossible d’ouvrir la correction.');
            window.close();
          }catch(err){setStatus(err.message||String(err),'err');b.disabled=false;}
        }),
        button('Envoyer le résultat global dans Gestion','secondary',async e=>{
          const b=e.currentTarget;b.disabled=true;setStatus('Préparation du résultat global…');
          try{
            const r=await sendFormative(tab.id,'CARDINAL_SIMPLE_SEND_GLOBAL');
            if(r?.ok===false)throw new Error(r.message||'Impossible de préparer le résultat global.');
            window.close();
          }catch(err){setStatus(err.message||String(err),'err');b.disabled=false;}
        })
      );
      setStatus('Formative reste complètement inchangé tant que tu n’ouvres pas une action Cardinal.','ok');
      return;
    }

    if (/^https:\/\/techno-cardi\.github\.io\/Exercices-francais\/resultats/i.test(url)) {
      $('pageTitle').textContent='Gestion des notes';
      $('pageMeta').textContent='La synchronisation Mozaïk et les imports Formative sont disponibles directement dans la plateforme.';
      setStatus('La détection des groupes et des listes Mozaïk s’effectue automatiquement au moment de la synchronisation.','ok');
      return;
    }

    if (/^https:\/\/mozaikportail\.ca\//i.test(url)) {
      $('pageTitle').textContent='Mozaïk';
      $('pageMeta').textContent='Cardinal observe les groupes, matières et listes officielles chargés par le portail pour garder la configuration à jour.';
      setStatus('Aucun bouton supplémentaire n’est ajouté à la page.','ok');
      return;
    }

    if (/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(url)) {
      $('pageTitle').textContent='Correction';
      $('pageMeta').textContent='Quand une correction Formative est en cours, Cardinal peut renvoyer le tableau final vers la bonne question.';
      setStatus('Le bouton de retour apparaît seulement lorsqu’une correction Formative est active.','ok');
      return;
    }

    $('pageTitle').textContent='Cardinal';
    $('pageMeta').textContent='Ouvre Formative, Gestion des notes ou Mozaïk pour utiliser les fonctions automatiques.';
    setStatus('');
  }

  render().catch(e=>setStatus(e?.message||String(e),'err'));
})();