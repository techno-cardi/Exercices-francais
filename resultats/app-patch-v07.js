(() => {
  if (window.__cardinalV07Installed) return;
  window.__cardinalV07Installed = true;

  const ROSTER_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-roster';
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';
  const pendingDiscovery = new Map();

  function versionAtLeast(v, min) {
    const a=String(v||'0').split('.').map(Number), b=String(min||'0').split('.').map(Number);
    for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x>y)return true;if(x<y)return false;}return true;
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== EXT_SOURCE) return;
    if (event.data.type !== 'MOZAIK_EXTENSION_DISCOVERY_RESULT') return;
    const id=String(event.data.requestId||'');const p=pendingDiscovery.get(id);if(!p)return;
    pendingDiscovery.delete(id);clearTimeout(p.timer);p.resolve(event.data.result||{ok:false,message:'Aucune réponse de détection.'});
  });

  function discoverGroup(groupCode) {
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const timer=setTimeout(()=>{pendingDiscovery.delete(requestId);reject(new Error('La détection automatique Mozaïk a expiré.'));},90000);
      pendingDiscovery.set(requestId,{resolve,reject,timer});
      window.postMessage({source:PAGE_SOURCE,type:'MOZAIK_EXTENSION_DISCOVER_GROUP',requestId,groupCode:String(groupCode||''),force:false},location.origin);
    });
  }

  async function syncDiscoveryToBackend(result, groupCode) {
    if (!result?.ok || !result.group || typeof api !== 'function' || !state?.teacherToken) return null;
    return api(ROSTER_ENDPOINT, {
      action:'syncDiscovery',
      teacherToken:state.teacherToken,
      groupCode:String(groupCode||''),
      group:result.group,
      students:Array.isArray(result.roster)?result.roster:[]
    });
  }

  function install() {
    try {
      if (typeof state === 'undefined' || typeof api !== 'function') { setTimeout(install,120); return; }
      const btn=document.getElementById('syncMozaikBtn');
      if(!btn||typeof btn.onclick!=='function'){setTimeout(install,120);return;}
      if(btn.dataset.cardinalDiscoveryV07==='1')return;
      btn.dataset.cardinalDiscoveryV07='1';
      const original=btn.onclick;
      btn.onclick=async function(...args){
        const group=String(state.detailGroup||state.currentAssignment?.groups?.[0]||'');
        const canDiscover=group && versionAtLeast(state.extensionVersion,'0.9.2');
        if(canDiscover){
          const oldText=btn.textContent;const syncState=document.getElementById('syncState');
          try{
            btn.disabled=true;btn.textContent='Détection Mozaïk...';
            if(syncState)syncState.textContent=`Détection automatique du groupe ${group} et de la liste officielle des élèves…`;
            const result=await discoverGroup(group);
            if(result?.ok){
              const saved=await syncDiscoveryToBackend(result,group);
              if(syncState&&saved?.ok!==false){
                const n=Number(saved?.rosterUpdated||0);
                syncState.textContent=`Groupe ${group} détecté automatiquement${n?` · ${n} nom${n===1?'':'s'} officiel${n===1?'':'s'} vérifié${n===1?'':'s'}`:''}. Préparation de la synchronisation…`;
              }
            } else if(syncState){
              syncState.textContent='Détection automatique incomplète. J’utilise la configuration Mozaïk déjà enregistrée.';
            }
          } catch(error){
            if(syncState)syncState.textContent='Détection automatique indisponible. J’utilise la configuration Mozaïk déjà enregistrée.';
          } finally {
            btn.disabled=false;btn.textContent=oldText;
          }
        }
        return original.apply(this,args);
      };
    } catch { setTimeout(install,120); }
  }

  install();
})();