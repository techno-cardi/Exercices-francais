(() => {
  if (window.__cardinalFormativeStealth093) return;
  window.__cardinalFormativeStealth093 = true;

  function scrubText(root) {
    try {
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        const before=String(node.nodeValue||'');
        if(/chatgpt/i.test(before)) node.nodeValue=before.replace(/ChatGPT/gi,'assistant de correction');
      }
    } catch {}
  }

  function sanitize() {
    const host=document.getElementById('cardinal-formative-simple-092');
    const root=host?.shadowRoot;
    if(!root)return null;
    const launcher=root.querySelector('.launcher');
    if(launcher)launcher.style.setProperty('display','none','important');
    const copy=root.getElementById('copyOpenBtn');
    if(copy)copy.textContent='Copier les réponses';
    const previewEyebrow=root.querySelector('#previewModal .eyebrow');
    if(previewEyebrow)previewEyebrow.textContent='Retour de correction';
    scrubText(root);
    return root;
  }

  function prepare() {
    const root=sanitize();
    if(!root){setTimeout(prepare,30);return;}
    const observer=new MutationObserver(()=>sanitize());
    observer.observe(root,{childList:true,subtree:true,characterData:true});
  }
  prepare();

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type!=='CARDINAL_SIMPLE_OPEN_CORRECTION'&&message?.type!=='CARDINAL_SIMPLE_SEND_GLOBAL')return;
    const root=sanitize();
    if(!root){sendResponse({ok:false,message:'Interface Cardinal non prête. Réessaie dans un instant.'});return;}
    const id=message.type==='CARDINAL_SIMPLE_OPEN_CORRECTION'?'correctBtn':'gestionBtn';
    const btn=root.getElementById(id);
    if(!btn){sendResponse({ok:false,message:'Action Cardinal introuvable.'});return;}
    btn.click();
    sendResponse({ok:true});
  });
})();