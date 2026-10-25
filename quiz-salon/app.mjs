import {CHARACTERS} from './backend/characters.mjs';
import {RoomLive} from './realtime.mjs';
import {resumeOutcome,isExpiredSession} from './session.mjs';
import {GameAudio} from './sound.mjs';
import {CATEGORIES,QUESTIONS} from './backend/questions.mjs';
import {createGame,joinGame,applyAction,publicState} from './backend/engine.mjs';
const TV_MODE=new URLSearchParams(location.search).has('tv')||navigator.userAgent.includes('QuizSalonTV');document.body.classList.toggle('tv-mode',TV_MODE);
const API='https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/quiz-salon';
const app=document.querySelector('#app'),letters=['A','B','C','D'];
const palette=['#edb968','#99bfef','#c6a3e9','#9fd0aa','#f0a38d','#efabc6'];
let session=null,state=null,solo=null,screen='home',busy=false,polling=false,epoch=0,lastSignature='',offset=0,soundOn=true,lastPhase='',toastTimer,lastScene='',lastTick='',lastPlayerCount=0,live=null,liveCode='',dirty=false,refreshTimer=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cat=id=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];
const fmt=n=>new Intl.NumberFormat('fr-CA').format(n);
const store={get(key,local=false){try{return JSON.parse((local?localStorage:sessionStorage).getItem(key)||'null');}catch{return null;}},set(key,value,local=false){try{(local?localStorage:sessionStorage).setItem(key,JSON.stringify(value));}catch{}},remove(key,local=false){try{(local?localStorage:sessionStorage).removeItem(key);}catch{}}};
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4200);}
function connection(message=''){const el=document.querySelector('#connection');el.hidden=!message;el.textContent=message;}
const audio=new GameAudio(store.get('quiz-sound',true)!==false);soundOn=audio.enabled;
function beep(kind='select'){audio.play(kind);}
function soundUI(){const el=document.querySelector('#sound');el.classList.toggle('active',soundOn);el.setAttribute('aria-label',soundOn?'Couper le son':'Activer le son');el.setAttribute('aria-pressed',String(soundOn));el.title=soundOn?'Son activé':'Son coupé';}
soundUI();document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
function sceneEffects(s){
 const key=s.gameId+':'+s.phase+':'+s.round;const changed=key!==lastScene;app.classList.toggle('scene-enter',changed);
 if(s.phase==='lobby'&&s.players.length>lastPlayerCount&&session?.role==='host')beep('join');
 lastPlayerCount=s.players.length;
 if(changed){if(session?.role==='host')app.querySelector('[data-action="advance"],[data-action="rematch"]')?.focus({preventScroll:true});if(s.phase==='question')beep(s.round===0?'start':'question');
  if(s.phase==='reveal'){beep(s.me?(s.me.wasCorrect?'correct':'wrong'):'reveal');if(s.me?.wasCorrect)confetti(25);}
  if(s.phase==='finished'){beep('finish');confetti(65);}
 }lastScene=key;
}
function confetti(count){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const wrap=document.createElement('div');wrap.className='confetti';wrap.setAttribute('aria-hidden','true');
 for(let i=0;i<count;i++){const bit=document.createElement('i');bit.style.cssText=`--x:${Math.random()*100}%;--delay:${Math.random()*.5}s;--spin:${Math.random()*720}deg;--drift:${(Math.random()-.5)*260}px;background:${palette[i%palette.length]}`;wrap.append(bit);}document.body.append(wrap);setTimeout(()=>wrap.remove(),3500);
}
function avatar(p,index=0){return `<span class="avatar" style="--avatar:${palette[index%palette.length]}">${CHARACTERS.find(c=>c.id===p.avatar)?.icon||esc(p.name.slice(0,1).toUpperCase())}</span>`;}
function categoryDots(p){return `<span class="category-dots" aria-label="${p.categories.length} catégories réussies sur ${CATEGORIES.length}">${CATEGORIES.map(c=>`<i style="--cat:${c.color}" class="${p.categories.includes(c.id)?'won':''}"></i>`).join('')}</span>`;}
function setPage(name){screen=name;lastSignature='';document.body.classList.remove('player-mode');connection();}
function home(){
 stopLive();session=null;state=null;solo=null;epoch++;setPage('home');history.replaceState(null,'',location.pathname);
 const active=store.get('quiz-host-active',true)||store.get('quiz-host-active');
 app.innerHTML=`<section class="hero"><div><p class="eyebrow">LA CULTURE GÉNÉRALE, VERSION SOIRÉE</p><h1>Les bonnes questions.<br>La bonne <em>gang.</em></h1><p class="intro">La télé fait le spectacle. Vos téléphones font le reste. Un quiz d’ici, à jouer ensemble.</p><div class="actions"><button class="btn primary" data-action="setup">Créer une partie <span aria-hidden="true">↗</span></button><button class="btn outline" data-action="solo-setup">Essayer en solo</button></div><p class="micro"><span>✓</span> Aucun compte · Aucun téléchargement · 1 à 32 joueurs</p>${active?`<button class="back" data-action="resume-host" style="margin-top:12px">Reprendre ma partie ${esc(active.code)} ↗</button>`:''}</div><div class="preview-wrap"><div class="wheel" aria-hidden="true"></div><div class="preview-card"><div class="preview-meta"><span>⚜ QUÉBEC & CANADA</span><span>À VOUS DE VOIR</span></div><h2>Quel oiseau est l’emblème du Québec?</h2><div class="preview-options">${['Le geai bleu','Le harfang des neiges','Le huard','Le cardinal rouge'].map((s,i)=>`<button class="preview-option" data-preview="${i}"><strong>${letters[i]}</strong>${s}</button>`).join('')}</div><p id="preview-feedback" class="hint" style="color:#56705f;margin:16px 0 0">Une idée? Touche une réponse.</p></div><div class="preview-caption"><b>${QUESTIONS.length} questions.</b> De « facile! » à « ben voyons donc! »</div></div></section><section class="home-strip"><form id="quick-join" class="join-inline"><label for="quick-code">La partie est déjà lancée?</label><input id="quick-code" name="code" maxlength="6" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-label="Code de partie"><button class="btn small outline" type="submit">Rejoindre ↗</button></form><p class="hint">Un téléphone par joueur. Une télé pour la gang.</p></section><section class="category-section"><div class="section-line"><h3>De quoi faire jaser tout le monde.</h3><span>${CATEGORIES.length} catégories · 3 niveaux</span></div><div class="category-grid">${CATEGORIES.map(c=>`<div class="category-tile" style="--cat:${c.color}"><span class="cat-icon" aria-hidden="true">${c.icon}</span><b>${c.name}</b><span>${QUESTIONS.filter(q=>q.category===c.id).length} questions</span></div>`).join('')}</div></section>`;
 document.title='Quiz de salon - À vous de jouer';
}
function setup(isSolo=false){
 setPage(isSolo?'setup-solo':'setup');
 app.innerHTML=`<div class="setup-layout"><div class="setup-heading"><button class="back" data-action="home">← Accueil</button><p class="eyebrow">${isSolo?'JUSTE POUR LE PLAISIR':'ON PRÉPARE LA SOIRÉE'}</p><h1>${isSolo?'À toi de jouer.':'À votre façon.'}</h1><p class="intro">${isSolo?'Un petit tour de chauffe, sans connexion à une salle. Choisis tes questions et vois jusqu’où tu peux aller.':'Choisis le rythme, ouvre le salon et laisse la gang se connecter.'}</p><p class="notice" style="margin-top:28px">${isSolo?'Les réponses et les explications s’affichent après chaque question.':'Sur la télé : garde cette page ouverte. Sur les téléphones : scannez le code QR qui apparaîtra.'}</p></div><form id="settings" class="panel"><fieldset><legend>Nombre de questions</legend><div class="count-control"><button type="button" class="icon-button" data-count-adjust="-1" aria-label="Une question de moins">−</button><label class="sr-only" for="question-count">Nombre de questions</label><input id="question-count" name="count" type="number" min="1" max="${QUESTIONS.length}" value="20" inputmode="numeric" required><button type="button" class="icon-button" data-count-adjust="1" aria-label="Une question de plus">+</button><span class="hint">De 1 à ${QUESTIONS.length}</span></div><div class="pill-group count-presets">${[10,20,30,50,100].map(n=>`<button type="button" class="pill" data-count="${n}">${n}</button>`).join('')}</div></fieldset><fieldset><legend>Niveau</legend><div class="pill-group">${[['mix','Tous niveaux'],['progressive','Progressif ↗'],['1','Facile'],['2','Intermédiaire'],['3','Expert']].map(([v,n])=>`<label class="pill" tabindex="0"><input type="radio" name="difficulty" value="${v}" ${v==='mix'?'checked':''}>${n}</label>`).join('')}</div></fieldset><fieldset><legend>Temps par question</legend><div class="pill-group">${[[20,'20 s'],[30,'30 s'],[45,'45 s'],[0,'Sans chrono']].map(([v,n])=>`<label class="pill" tabindex="0"><input type="radio" name="seconds" value="${v}" ${v===30?'checked':''}>${n}</label>`).join('')}</div></fieldset><fieldset><legend>Catégories <span class="hint">· coche celles qui te tentent</span></legend><div class="setup-cats">${CATEGORIES.map(c=>`<label class="pill" tabindex="0" style="--cat:${c.color}"><input type="checkbox" name="category" value="${c.id}" checked><i aria-hidden="true">${c.icon}</i>${c.name}</label>`).join('')}</div></fieldset><div class="setup-foot"><span class="hint" id="available">${QUESTIONS.length} questions disponibles</span><button class="btn primary" type="submit">${isSolo?'Commencer':'Ouvrir le salon'} <span aria-hidden="true">↗</span></button></div><p class="error" id="form-error" role="alert"></p></form></div>`;
}
function joinForm(code=''){
 session=null;state=null;solo=null;epoch++;setPage('join');document.body.classList.add('player-mode');
 history.replaceState(null,'',location.pathname+(code?'?code='+encodeURIComponent(code):''));
 app.innerHTML=`<div class="narrow"><button class="back" data-action="home">← Accueil</button><p class="eyebrow">UNE PLACE T’ATTEND</p><h1>Entre dans<br>la partie.</h1><p class="muted">Le code est sur la télé. Choisis ton nom et ton personnage.</p><form id="join-form" class="panel"><div class="form-row"><label class="field" for="join-code">Code de partie</label><input id="join-code" name="code" class="code-input" value="${esc(code)}" maxlength="6" placeholder="ABC234" autocomplete="off" autocapitalize="characters" spellcheck="false" required></div><div class="form-row"><label class="field" for="join-name">Ton nom ou surnom</label><input id="join-name" name="name" maxlength="24" placeholder="Ex. : Kevin" autocomplete="given-name" required></div><fieldset><legend>Ton personnage</legend><div class="character-grid">${CHARACTERS.map((c,i)=>`<label class="character" title="${c.name}"><input type="radio" name="avatar" value="${c.id}" ${i===0?'checked':''}><span aria-hidden="true">${c.icon}</span><small>${c.name}</small></label>`).join('')}</div></fieldset><button class="btn primary" type="submit">C’est parti! ↗</button><p class="error" id="form-error" role="alert"></p></form><p class="hint" style="margin-top:20px">Garde cette page ouverte pour répondre. Si tu reviens sur ce téléphone, ton score t’attendra.</p></div>`;
}
function remember(s){session=s;store.set('quiz-'+s.role+'-'+s.code,s,true);if(s.role==='host')store.set('quiz-host-active',s,true);startLive(s.code);history.replaceState(null,'',location.pathname+(s.role==='host'?'?host=':'?code=')+s.code);}
async function request(payload){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000),start=Date.now();
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});let data;try{data=await r.json();}catch{throw new Error('Le serveur ne répond pas. Réessaie dans un instant.');}if(!r.ok){const e=new Error(data.error||'Connexion impossible.');e.status=r.status;throw e;}if(data.state)offset=data.state.serverTime-(start+Date.now())/2;return data;}
 catch(e){if(e.name==='AbortError')throw new Error('La connexion est lente. Réessaie dans un instant.');throw e;}finally{clearTimeout(timeout);}
}
function stopLive(){live?.stop();live=null;liveCode='';dirty=false;clearTimeout(refreshTimer);}
function refreshSoon(){dirty=true;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(session&&!busy&&!polling){dirty=false;poll();}else if(session)refreshSoon();},60);}
function startLive(code){if(live&&liveCode===code)return;stopLive();liveCode=code;live=new RoomLive(code,refreshSoon,connected=>document.body.classList.toggle('live-connected',connected));}
function credentials(action,data){return {...session,action,data};}
function accept(s,force=false){
 state=s;screen='game';document.body.classList.toggle('player-mode',session?.role==='player');connection();
 const sig=JSON.stringify({...s,serverTime:0});
 if(sig===lastSignature&&!force){tick();return;}lastSignature=sig;renderGame();sceneEffects(s);tick();
}
async function poll(){
 if(!session||solo||busy||polling||(document.hidden&&session.role==='player'))return;
 polling=true;const captured=epoch;
 try{const data=await request(credentials('state'));if(captured===epoch&&session)accept(data.state);}
 catch(e){if(captured===epoch&&session){if(isExpiredSession(e)){endSession(e.message);}else connection(navigator.onLine?'Reconnexion en cours… Ta réponse reste enregistrée si elle a été reçue.':'Hors ligne. La partie reprendra dès le retour d’Internet.');}}
 finally{polling=false;if(dirty)refreshSoon();}
}
async function command(action,data={}){
 if(busy)return;busy=true;epoch++;const captured=epoch;app.querySelectorAll('[data-action="advance"],[data-choice],[data-action="rematch"]').forEach(b=>b.disabled=true);
 try{
  if(solo){applyAction(solo,{role:'host',hash:'local'},action,data,Date.now(),QUESTIONS);accept(publicState(solo,{role:'player',id:'solo',hash:'local'}),true);}
  else{const response=await request(credentials(action,data));if(captured!==epoch)return;if(action==='leave'||action==='close'){forgetSession();home();return;}accept(response.state,true);}
 }catch(e){toast(e.message);if(state)accept(state,true);}finally{busy=false;tick();if(dirty)refreshSoon();}
}
function forgetSession(){if(!session)return;stopLive();store.remove('quiz-'+session.role+'-'+session.code,true);store.remove('quiz-'+session.role+'-'+session.code);if(session.role==='host'){store.remove('quiz-host-active',true);store.remove('quiz-host-active');}session=null;epoch++;}
function endSession(message){forgetSession();setPage('ended');app.innerHTML=`<div class="narrow waiting"><p class="eyebrow">LE SALON</p><h1>La partie est fermée.</h1><p class="muted">${esc(message)}</p><button class="btn primary" data-action="home">Retour à l’accueil</button></div>`;connection();}
function leaders(s,full=false){return s.players.slice(0,full?32:7).map((p,i)=>`<div class="leader"><span class="rank">${p.rank}</span>${avatar(p,i)}<span class="name">${esc(p.name)}${categoryDots(p)}</span><span class="score">${fmt(p.score)}</span>${session?.role==='host'&&s.phase!=='finished'?`<button class="kick-live" data-kick="${esc(p.id)}" aria-label="Retirer ${esc(p.name)}">×</button>`:''}</div>`).join('');}
function sidebar(s){return `<aside class="score-panel"><h3>Le classement</h3><div class="leader-list">${leaders(s,session?.role==='host')}</div><div class="mini-code">Code de partie<b>${esc(session?.code||'SOLO')}</b>${session?.role==='host'?'<button class="text-button" data-action="copy-link" style="padding:10px 0 0;font-size:11px">Copier le lien ↗</button><div id="mini-qr" class="mini-qr" role="img" aria-label="Code QR pour rejoindre la partie"></div>':''}</div></aside>`;}
function renderGame(){
 const s=state,host=session?.role==='host',isSolo=!!solo,isPlayer=session?.role==='player',opts=s.options;
 if(s.phase==='closed'){endSession('L’hôte a fermé cette partie.');return;}
 document.title=`${s.phase==='lobby'?'Salon ouvert':s.phase==='finished'?'Résultats':`Question ${s.round+1}`} - Quiz de salon`;
 if(s.phase==='lobby'){
  if(host){
   app.innerHTML=`<div class="room-heading"><div><p class="eyebrow">LE SALON EST OUVERT</p><h1>On attend la gang.</h1></div><span class="tag">ÉCRAN TÉLÉ · ${s.players.length} / 32 joueurs</span></div><p class="room-sub">${s.total} questions · ${opts.difficulty==='progressive'?'Difficulté progressive':opts.difficulty==='mix'?'Tous niveaux':['','Facile','Intermédiaire','Expert'][Number(opts.difficulty)]} · ${opts.seconds?opts.seconds+' s par question':'Sans chrono'}</p><div class="lobby-layout"><div>${s.players.length?`<div class="players">${s.players.map((p,i)=>`<div class="player">${avatar(p,i)}<b class="player-name">${esc(p.name)}</b><button class="kick" data-kick="${esc(p.id)}" aria-label="Retirer ${esc(p.name)}">×</button></div>`).join('')}</div>`:'<div class="empty-lobby"><span class="big" aria-hidden="true">↗</span><b>Le premier joueur, c’est qui?</b><span>Scannez le code QR avec vos téléphones.<br>Les prénoms apparaîtront ici.</span></div>'}<div class="lobby-bottom"><button class="btn primary" data-action="advance" ${!s.players.length?'disabled':''}>Lancer la partie <span aria-hidden="true">→</span></button><span class="hint">L’hôte peut aussi jouer avec son téléphone.</span></div><button class="text-button" data-action="close">Fermer ce salon</button></div><aside class="qr-panel"><p class="eyebrow">SCANNE POUR REJOINDRE</p><div class="qr-box" id="qr" role="img" aria-label="Code QR pour rejoindre la partie ${esc(session.code)}"></div><p class="room-code">${esc(session.code)}</p><p class="hint">Ou entre ce code sur la page du jeu.</p><button class="btn small outline" data-action="copy-link">Copier le lien ↗</button><p class="join-address">${esc(location.host+location.pathname)}</p></aside></div>`;
   renderQR();
  }else{
   const me=s.me;
   app.innerHTML=`<div class="narrow waiting">${avatar(me)}<p class="eyebrow" style="justify-content:center">TU ES DANS LA PARTIE</p><h1>Bienvenue,<br>${esc(me.name)}.</h1><p class="muted">Regarde la télé. L’hôte lancera la partie quand tout le monde sera prêt.</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="tag" style="display:inline-block">${s.players.length} joueur${s.players.length>1?'s':''} · Code ${esc(session.code)}</p><p class="hint">Garde ce téléphone pour répondre.</p><button class="text-button" data-action="leave">Quitter la partie</button></div>`;
  }return;
 }
 if(s.phase==='finished'){renderFinal();return;}
 const q=s.question,c=cat(q.category),reveal=s.phase==='reveal',canAnswer=isPlayer||isSolo,me=s.me,chosen=me?.choice;
 app.innerHTML=`${canAnswer?`<div class="mobile-self"><span>${esc(me.name)} ${isSolo?'· En solo':'· Mode téléphone'}</span><strong>${fmt(me.score)} points</strong></div>`:''}<div class="play-top" style="--cat:${c.color}"><p class="eyebrow">${c.icon} ${c.name}</p><span class="round-label">QUESTION <b>${s.round+1}</b> / ${s.total}</span></div><div class="question-layout"><section class="question-main" style="--cat:${c.color}"><div class="question-banner"><span class="difficulty">${['','Facile','Intermédiaire','Expert'][q.level]}</span>${opts.difficulty==='progressive'?'<span class="hint">Niveau progressif ↗</span>':''}<div class="timer"><span class="hint">${reveal?'Réponse dévoilée':opts.seconds?'Il reste':'À votre rythme'}</span>${!reveal&&opts.seconds?'<span class="timer-circle" id="seconds">…</span>':''}</div></div><div class="timer-track"><div class="timer-fill" id="timer-fill"></div></div><h1>${esc(q.text)}</h1><div class="options">${q.options.map((option,i)=>`<button class="answer ${chosen===i?'chosen':''} ${reveal?(i===q.correct?'correct':chosen===i?'wrong':'faded'):''}" data-choice="${i}" ${!canAnswer||reveal||chosen!==null?'disabled':''} aria-label="${letters[i]} : ${esc(option)}" ${chosen===i?'aria-pressed="true"':''}><strong>${letters[i]}</strong><span class="answer-text">${esc(option)}</span>${reveal&&host?`<span class="votes">${s.distribution[i]} réponse${s.distribution[i]>1?'s':''}</span>`:''}</button>`).join('')}</div>${reveal?`${canAnswer?`<div class="points-result ${!me.wasCorrect?'missed':''}" role="status"><strong>+${fmt(me.points)}</strong><span>${me.choice===null?'Aucune réponse reçue.':me.wasCorrect?'Bonne réponse!':'Ce n’était pas celle-là.'}</span></div>`:''}<div class="explanation"><p>${esc(q.explanation)}</p><a href="${esc(q.source)}" target="_blank" rel="noopener noreferrer">Consulter la source ↗</a></div>`:''}<div class="question-footer"><span class="status-line" role="status">${reveal?'On prend le temps d’en parler.':canAnswer?(chosen!==null?`<strong>✓ Réponse ${letters[chosen]} enregistrée.</strong> Regarde la télé.`:'Choisis ta réponse sur ce téléphone.'):`<strong>${s.answeredCount} / ${s.players.length}</strong> ont répondu`}</span>${host||isSolo?`<button class="btn ${reveal?'primary':'outline'}" data-action="advance">${reveal?(s.round+1===s.total?'Voir les résultats':'Question suivante'):'Dévoiler la réponse'} <span aria-hidden="true">→</span></button>`:''}</div><div class="progress-pips" aria-hidden="true">${Array.from({length:s.total},(_,i)=>`<i class="${i<s.round?'done':i===s.round?'current':''}"></i>`).join('')}</div>${isPlayer?'<button class="text-button" data-action="leave" style="font-size:11px;padding:12px 0">Quitter la partie</button>':''}</section>${sidebar(s)}</div>`;if(host)renderQR('mini-qr');
}
function renderFinal(){
 const s=state,top=s.players.slice(0,3),order=top.length>=2?[top[1],top[0],top[2]].filter(Boolean):top;
 app.innerHTML=`<div class="podium-header"><p class="eyebrow">LA PARTIE EST TERMINÉE</p><h1>${top.length?top.filter(p=>p.rank===1).length>1?'La victoire se partage!':`Bien joué, ${esc(top[0].name)}!`:'Merci d’avoir joué.'}</h1><p class="muted">${s.total} questions. Et quelques bonnes discussions.</p></div><div class="podium">${order.map(p=>`<div class="podium-slot ${p.rank===1?'first':''}">${avatar(p,s.players.indexOf(p))}<b>${esc(p.name)}</b><div class="pedestal"><div class="place">${p.rank===1?'♛':p.rank}</div><b>${fmt(p.score)} points</b><br>${p.correct} / ${s.total} bonnes réponses</div></div>`).join('')}</div><div class="ranking">${leaders(s,true)}</div><div class="center-actions">${session?.role==='host'||solo?'<button class="btn primary" data-action="rematch">La revanche! ↗</button>':'<p class="muted">L’hôte peut lancer une revanche. Tu restes connecté.</p>'}<button class="btn outline" data-action="${session?.role==='player'?'leave':session?.role==='host'?'close':'home'}">${session?.role==='host'?'Fermer la partie':'Retour à l’accueil'}</button></div>`;
}
function joinLink(){return new URL('?code='+session.code,location.href).href;}
function renderQR(id='qr'){const target=document.getElementById(id);if(!target)return;if(typeof window.qrcode!=='function'){target.textContent='Entre le code ci-dessous pour rejoindre.';return;}const qr=window.qrcode(0,'M');qr.addData(joinLink());qr.make();target.innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true});const svg=target.querySelector('svg');svg?.setAttribute('aria-hidden','true');}
function tick(){
 if(!state||screen!=='game')return;
 const left=state.deadline===null?null:Math.max(0,Math.ceil((state.deadline-(Date.now()+offset))/1000));
 const el=document.querySelector('#seconds');if(el){el.textContent=left+' s';el.classList.toggle('urgent',left<=5);}
 const fill=document.querySelector('#timer-fill');if(fill)fill.style.width=(state.phase==='reveal'?100:left===null?100:Math.max(0,Math.min(100,left/state.options.seconds*100)))+'%';
 if(state.phase==='question'&&left!==null&&left<=5&&(session?.role==='host'||solo)){const k=state.gameId+':'+state.round+':'+left;if(k!==lastTick){lastTick=k;beep(left===0?'timeout':'tick');}}
 if(state.phase==='question'&&left===0){if(!solo&&!busy&&!polling)refreshSoon();app.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);if(solo){applyAction(solo,{role:'player',id:'solo',hash:'local'},'state',{},Date.now());accept(publicState(solo,{role:'player',id:'solo',hash:'local'}));}}
}
async function resume(s){
 if(!s)return home();busy=true;epoch++;session=s;setPage('loading');app.innerHTML='<p class="loading">On retrouve ta partie…</p>';
 const outcome=await resumeOutcome(()=>request(credentials('state')));
 if(outcome.kind==='ready'){remember(s);lastPhase='';accept(outcome.data.state,true);}
 else if(outcome.kind==='invalid'){forgetSession();joinForm(s.role==='player'?s.code:'');toast(outcome.error.message);}
 else{remember(s);screen='reconnecting';app.innerHTML='<div class="narrow waiting"><h1>On garde ta place.</h1><p class="muted">Ta connexion est interrompue. Ton accès et ton score sont conservés; la reconnexion se fera automatiquement.</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><button class="btn outline" data-action="retry">Réessayer maintenant</button></div>';connection(outcome.error.message);}
 busy=false;
}
app.addEventListener('click',async event=>{
 const adjust=event.target.closest('[data-count-adjust]');if(adjust){const input=document.querySelector('#question-count');input.value=Math.max(1,Math.min(QUESTIONS.length,Number(input.value)+Number(adjust.dataset.countAdjust)));input.dispatchEvent(new Event('change',{bubbles:true}));return;}
 const preset=event.target.closest('[data-count]');if(preset){document.querySelector('#question-count').value=preset.dataset.count;document.querySelector('#question-count').dispatchEvent(new Event('change',{bubbles:true}));beep();return;}
 const preview=event.target.closest('[data-preview]');if(preview){const answer=Number(preview.dataset.preview);app.querySelectorAll('[data-preview]').forEach(b=>{b.classList.toggle('selected',b.dataset.preview==='1');b.setAttribute('aria-pressed',String(b===preview));});document.querySelector('#preview-feedback').textContent=answer===1?'Exact! Le harfang des neiges.':'C’est le harfang des neiges. On en apprend à chaque question.';beep();return;}
 const choice=event.target.closest('[data-choice]');if(choice&&!choice.disabled){beep();choice.classList.add('chosen');const status=app.querySelector('.status-line');if(status)status.textContent='Envoi de ta réponse…';if(solo){if(busy)return;busy=true;applyAction(solo,{role:'player',id:'solo',hash:'local'},'answer',{gameId:state.gameId,round:state.round,choice:Number(choice.dataset.choice)},Date.now());accept(publicState(solo,{role:'player',id:'solo',hash:'local'}),true);busy=false;}else await command('answer',{gameId:state.gameId,round:state.round,choice:Number(choice.dataset.choice)});return;}
 const kick=event.target.closest('[data-kick]');if(kick){await command('kick',{id:kick.dataset.kick});return;}
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
 const a=button.dataset.action;
 if(a==='home')home();else if(a==='setup'){if(TV_MODE&&document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});beep();setup();}else if(a==='solo-setup'){beep();setup(true);}
 else if(a==='retry')await resume(session);
 else if(a==='resume-host')await resume(store.get('quiz-host-active',true)||store.get('quiz-host-active'));
 else if(a==='advance'||a==='rematch'){await command(a,{expected:`${state.phase}:${state.round}`,gameId:state.gameId});if(solo&&state.phase==='lobby'){applyAction(solo,{role:'host',hash:'local'},'advance',{expected:'lobby:0'},Date.now());accept(publicState(solo,{role:'player',id:'solo',hash:'local'}),true);}}
 else if(a==='close'||a==='leave')await command(a);
 else if(a==='copy-link'){try{await navigator.clipboard.writeText(joinLink());toast('Lien de la partie copié.');}catch{toast(joinLink());}}
});
app.addEventListener('change',event=>{if(event.target.closest('#settings')){const f=new FormData(document.querySelector('#settings')),cats=f.getAll('category'),level=f.get('difficulty');const n=QUESTIONS.filter(q=>cats.includes(q.category)&&(!['1','2','3'].includes(level)||q.level===Number(level))).length;document.querySelector('#available').textContent=`${n} questions disponibles${n<Number(f.get('count'))?' · partie limitée à '+n:''}`;}});
app.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,f=new FormData(form);
 if(form.id==='quick-join'){const code=String(f.get('code')).trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){toast('Entre les 6 caractères du code affiché à la télé.');return;}const saved=store.get('quiz-player-'+code,true);saved?await resume(saved):joinForm(code);return;}
 if(busy)return;const error=document.querySelector('#form-error'),submit=form.querySelector('[type="submit"]');error.textContent='';submit.disabled=true;busy=true;epoch++;
 try{
  if(form.id==='settings'){
   const categories=f.getAll('category');if(!categories.length)throw new Error('Choisis au moins une catégorie.');
   const options={count:Number(f.get('count')),difficulty:f.get('difficulty'),seconds:Number(f.get('seconds')),categories};
   if(screen==='setup-solo'){
    solo=createGame(options,QUESTIONS,Date.now());joinGame(solo,'Toi','solo','local');applyAction(solo,{role:'host',hash:'local'},'advance',{expected:'lobby:0'},Date.now());session=null;offset=0;lastPhase='';accept(publicState(solo,{role:'player',id:'solo',hash:'local'}),true);
   }else{
    const d=await request({action:'create',options});remember({code:d.code,token:d.token,role:'host'});lastPhase='';accept(d.state,true);
   }
  }else if(form.id==='join-form'){
   const code=String(f.get('code')).trim().toUpperCase(),saved=store.get('quiz-player-'+code,true);
   if(saved){busy=false;await resume(saved);return;}
   const d=await request({action:'join',code,name:f.get('name'),avatar:f.get('avatar')});remember({code:d.code,token:d.token,id:d.id,role:'player'});lastPhase='';accept(d.state,true);
  }
 }catch(e){error.textContent=e.message;submit.disabled=false;}finally{busy=false;}
});
document.querySelector('#help').addEventListener('click',()=>document.querySelector('#help-dialog').showModal());
document.querySelector('.dialog-close').addEventListener('click',()=>document.querySelector('#help-dialog').close());
document.querySelector('#sound').addEventListener('click',()=>{soundOn=!soundOn;audio.enabled=soundOn;store.set('quiz-sound',soundOn,true);soundUI();beep();});
document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Utilise le mode plein écran de ton navigateur.');}catch{toast('Le plein écran n’est pas disponible dans ce navigateur.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();tick();}});window.addEventListener('online',()=>poll());window.addEventListener('offline',()=>{if(session)connection('Hors ligne. La partie reprendra dès le retour d’Internet.');});
setInterval(()=>{if(!live?.connected)poll();},1600);setInterval(poll,12000);setInterval(tick,200);
const params=new URLSearchParams(location.search),code=(params.get('code')||'').toUpperCase(),hostCode=(params.get('host')||'').toUpperCase();
if(hostCode){const saved=store.get('quiz-host-'+hostCode,true)||store.get('quiz-host-'+hostCode);saved?resume(saved):joinForm(hostCode);}else if(code){const saved=store.get('quiz-player-'+code,true);saved?resume(saved):joinForm(code);}else home();
// Keyboard/D-pad navigation for a TV browser, plus normal Enter activation.
document.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return;
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 const controls=[...document.querySelectorAll('button:not(:disabled),a[href],label.pill')].filter(el=>el.getClientRects().length);
 const current=document.activeElement,rect=current?.getBoundingClientRect();
 if(!controls.includes(current)){const first=app.querySelector('.btn:not(:disabled)');if(first){event.preventDefault();first.focus();}return;}
 const x=rect.x+rect.width/2,y=rect.y+rect.height/2,horizontal=['ArrowLeft','ArrowRight'].includes(event.key),sign=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;
 const ranked=controls.filter(el=>el!==current).map(el=>{const r=el.getBoundingClientRect(),dx=r.x+r.width/2-x,dy=r.y+r.height/2-y;return {el,forward:(horizontal?dx:dy)*sign,distance:Math.abs(horizontal?dx:dy)+Math.abs(horizontal?dy:dx)*2};}).filter(v=>v.forward>4).sort((a,b)=>a.distance-b.distance);
 if(ranked.length){event.preventDefault();ranked[0].el.focus();}
});

document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&document.activeElement?.matches('label.pill')){event.preventDefault();document.activeElement.click();}});
