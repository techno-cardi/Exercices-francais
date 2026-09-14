(() => {
  if (window.__cardinalFormativeUiV08) return;
  window.__cardinalFormativeUiV08 = true;

  const m = location.pathname.match(/^\/formatives\/([^/]+)\/results\/?$/);
  if (!m) return;

  const host = document.createElement('div');
  host.id = 'cardinal-formative-tools';
  host.style.position = 'fixed';
  host.style.right = '22px';
  host.style.bottom = '22px';
  host.style.zIndex = '2147483647';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{all:initial}
      .wrap{font-family:Inter,Segoe UI,Arial,sans-serif}
      .send{border:0;border-radius:13px;padding:11px 15px;background:linear-gradient(135deg,#0d47b5,#1778ff);color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 12px 34px rgba(13,71,181,.24)}
      .send:hover{transform:translateY(-1px)}.send:disabled{opacity:.65;cursor:wait;transform:none}
      .box{display:none;width:345px;margin-bottom:10px;background:#fff;border:1px solid #dce6f2;border-radius:16px;box-shadow:0 18px 55px rgba(15,35,70,.22);padding:16px;color:#142033}
      .box.show{display:block}.title{font-size:14px;font-weight:850;margin:0}.msg{font-size:12.5px;line-height:1.4;color:#66758a;margin-top:6px}.ok{color:#14703d}.err{color:#9f261f}
      .bar{height:7px;background:#edf2f8;border-radius:99px;overflow:hidden;margin-top:12px}.fill{height:100%;width:20%;background:linear-gradient(90deg,#0d47b5,#1778ff);border-radius:99px;animation:move 1.2s linear infinite;position:relative}@keyframes move{0%{left:-20%}100%{left:100%}}
    </style>
    <div class="wrap">
      <div class="box" id="box"><div class="title" id="title"></div><div class="msg" id="msg"></div><div class="bar" id="bar"><div class="fill"></div></div></div>
      <button class="send" id="send" type="button">Envoyer vers Gestion des notes</button>
    </div>`;

  const btn = shadow.getElementById('send');
  const box = shadow.getElementById('box');
  const title = shadow.getElementById('title');
  const msg = shadow.getElementById('msg');
  const bar = shadow.getElementById('bar');

  function status(t, text, kind = '') {
    box.className = `box show ${kind}`;
    title.textContent = t;
    msg.textContent = text || '';
    bar.style.display = kind ? 'none' : '';
  }

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    status('Lecture de Formative', 'Je récupère le travail, les élèves et les notes…');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'FORMATIVE_SEND_TO_GESTION', formativeId: m[1] });
      if (!response?.ok) throw new Error(response?.message || 'Impossible de lire ce travail Formative.');
      status('Prêt', 'Gestion des notes a été ouverte avec les données du travail.', 'ok');
      setTimeout(() => box.classList.remove('show'), 4500);
    } catch (error) {
      status('Erreur', error?.message || String(error), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'CARDINAL_FORMATIVE_UI') return;
    status(message.title || 'Formative', message.message || '', message.status === 'error' ? 'err' : message.status === 'success' ? 'ok' : '');
  });
})();
