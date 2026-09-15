(() => {
  if (window.__cardinalMozaikDiscoveryBridge093) return;
  window.__cardinalMozaikDiscoveryBridge093 = true;
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';

  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.source !== PAGE_SOURCE || data?.type !== 'MOZAIK_EXTENSION_DISCOVER_GROUP_V2') return;
    const requestId = String(data.requestId || '');
    if (!requestId) return;
    try {
      const result = await chrome.runtime.sendMessage({
        type:'DISCOVER_MOZAIK_GROUP_V2',
        groupCode:String(data.groupCode || ''),
        force:data.force === true,
        fallbackGroup:data.fallbackGroup || null
      });
      window.postMessage({ source:EXT_SOURCE, type:'MOZAIK_EXTENSION_DISCOVERY_RESULT_V2', requestId, result }, location.origin);
    } catch (error) {
      window.postMessage({
        source:EXT_SOURCE,
        type:'MOZAIK_EXTENSION_DISCOVERY_RESULT_V2',
        requestId,
        result:{ ok:false, message:error?.message || String(error) }
      }, location.origin);
    }
  });
})();