(() => {
  if (window.__cardinalFormativeStealth092) return;
  window.__cardinalFormativeStealth092 = true;

  function ui() {
    const host=document.getElementById('cardinal-formative-simple-092');
    const root=host?.shadowRoot;
    if(!root)return null;
    const launcher=root.querySelector('.launcher');
    if(launcher)launcher.style.display='none';
    const copy=root.getElementById('copyOpenBtn');
    if(copy)copy.textContent='Copier les réponses';
    const previewEyebrow=root.querySelector('#previewModal .eyebrow');
    if(previewEyebrow)previewEyebrow.textContent='Retour de correction';
    return root;
  }

  function prepare() {
    const root=ui();
    if(!root){setTimeout(prepare,60);return;}
    const observer=new MutationObserver(ui);
    observer.observe(root,{childList:true,subtree:true});
  }
  prepare();

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type!=='CARDINAL_SIMPLE_OPEN_CORRECTION'&&message?.type!=='CARDINAL_SIMPLE_SEND_GLOBAL')return;
    const root=ui();
    if(!root){sendResponse({ok:false,message:'Interface Cardinal non prête. Recharge Formative une fois.'});return;}
    const id=message.type==='CARDINAL_SIMPLE_OPEN_CORRECTION'?'correctBtn':'gestionBtn';
    const btn=root.getElementById(id);
    if(!btn){sendResponse({ok:false,message:'Action Cardinal introuvable. Recharge Formative une fois.'});return;}
    btn.click();
    sendResponse({ok:true});
  });
})();
