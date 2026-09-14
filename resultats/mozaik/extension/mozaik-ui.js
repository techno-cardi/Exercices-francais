(() => {
  if (window.__cardinalMozaikUiV05) return;
  window.__cardinalMozaikUiV05 = true;

  const HOST_ID = 'cardinal-mozaik-sync-ui-host';
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed';
    host.style.top = '18px';
    host.style.right = '18px';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);
  }

  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{all:initial}
      .box{display:none;width:360px;background:#fff;border:1px solid #dce6f2;border-radius:16px;box-shadow:0 18px 55px rgba(15,35,70,.22);padding:18px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#142033}
      .box.show{display:block}
      .head{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
      .icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0d47b5,#1778ff);display:grid;place-items:center;color:white;font-weight:900;font-size:17px;flex:none}
      h3{margin:0;font-size:15px;line-height:1.2}
      p{margin:5px 0 0;color:#66758a;font-size:13px;line-height:1.4}
      .bar{height:8px;background:#eef3f8;border-radius:999px;overflow:hidden;margin-top:14px;position:relative}
      .fill{height:100%;width:0;background:linear-gradient(90deg,#0d47b5,#1778ff);border-radius:999px;transition:width .3s ease}
      .indeterminate .fill{width:42%!important;position:absolute;animation:move 1.2s linear infinite}
      @keyframes move{0%{left:-42%}100%{left:100%}}
      .success .icon{background:#17864b}.error .icon{background:#b3261e}
      .actions{display:none;gap:8px;justify-content:flex-end;margin-top:14px}.actions.show{display:flex}
      button{border:0;border-radius:10px;font:700 13px Inter,Segoe UI,Arial,sans-serif;padding:9px 13px;cursor:pointer}
      .primary{background:#0d47b5;color:#fff}.secondary{background:#eef3f8;color:#334155}
      .error .primary{background:#b3261e}
    </style>
    <div class="box" id="box">
      <div class="head"><div class="icon" id="icon">↻</div><div><h3 id="title">Synchronisation</h3><p id="message"></p></div></div>
      <div class="bar" id="bar"><div class="fill" id="fill"></div></div>
      <div class="actions" id="actions">
        <button class="primary" id="openBtn" type="button">Afficher le travail</button>
        <button class="secondary" id="closeBtn" type="button">Fermer</button>
      </div>
    </div>`;

  const box = shadow.getElementById('box');
  const title = shadow.getElementById('title');
  const message = shadow.getElementById('message');
  const bar = shadow.getElementById('bar');
  const fill = shadow.getElementById('fill');
  const actions = shadow.getElementById('actions');
  const openBtn = shadow.getElementById('openBtn');
  const closeBtn = shadow.getElementById('closeBtn');

  let current = {};
  const hide = () => box.classList.remove('show');

  document.addEventListener('pointerdown', event => {
    if (!box.classList.contains('show')) return;
    if (event.target === host || host.contains(event.target)) return;
    hide();
  }, true);

  closeBtn.addEventListener('click', () => {
    hide();
    chrome.runtime.sendMessage({ type: 'CLOSE_MOZAIK_TAB' });
  });

  openBtn.addEventListener('click', () => {
    hide();
    chrome.runtime.sendMessage({
      type: 'OPEN_MOZAIK_ACTIVITY',
      activityId: current.activityId || '',
      activityTitle: current.activityTitle || '',
      establishmentId: current.establishmentId || '',
      groupCourseId: current.groupCourseId || ''
    });
  });

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type !== 'CARDINAL_MOZAIK_SYNC_UI') return;
    current = { ...msg };
    box.className = `box show ${msg.status || ''}`;
    title.textContent = msg.title || 'Synchronisation Mozaïk';
    message.textContent = msg.message || '';
    fill.style.width = `${Math.max(0, Math.min(100, Number(msg.progress || 0)))}%`;
    bar.classList.toggle('indeterminate', !!msg.indeterminate);

    actions.classList.toggle('show', !!msg.closable);
    openBtn.style.display = msg.canOpenActivity ? '' : 'none';
  });
})();
