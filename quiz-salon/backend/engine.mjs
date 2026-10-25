import {CHARACTERS} from './characters.mjs';
import {CATEGORIES,LOCAL_THEMES} from './questions.mjs';
export const REVEAL_MS=8000;
const categoryIds=new Set(CATEGORIES.map(c=>c.id));
export function shuffle(items,rng=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function settings(input={}){
 const count=Number.isInteger(Number(input.count))&&Number(input.count)>=1&&Number(input.count)<=300?Number(input.count):20;
 const difficulty=['mix','progressive','1','2','3'].includes(String(input.difficulty))?String(input.difficulty):'mix';
 const seconds=[0,20,30,45].includes(Number(input.seconds))?Number(input.seconds):30;
 const categories=Array.isArray(input.categories)?[...new Set(input.categories.filter(c=>categoryIds.has(c)))]:[];
 const localThemes=Array.isArray(input.localThemes)?input.localThemes.filter(t=>LOCAL_THEMES.some(x=>x.id===t)):[];
 return {count,difficulty,seconds,categories,localThemes};
}
export function selectDeck(bank,input,rng=Math.random){
 const o=settings(input);let pool=bank.filter(q=>(!o.categories.length||o.categories.includes(q.category))&&(!['1','2','3'].includes(o.difficulty)||q.level===Number(o.difficulty))&&(q.category!=='local'||!o.localThemes.length||o.localThemes.includes(q.theme))); 
 let chosen=[];
 if(o.difficulty==='progressive'){
  const count=Math.min(o.count,pool.length);const used=new Set();
  for(let i=0;i<count;i++){
   const level=Math.min(3,Math.floor(i*3/count)+1);
   const q=shuffle(pool.filter(q=>q.level===level&&!used.has(q.id)),rng)[0]||shuffle(pool.filter(q=>!used.has(q.id)),rng)[0];
   if(q){chosen.push(q);used.add(q.id);}
  }
  chosen.sort((a,b)=>a.level-b.level);
 }else{
  // Round robin across shuffled categories keeps broad games varied.
  const groups=shuffle(CATEGORIES.map(c=>shuffle(pool.filter(q=>q.category===c.id),rng)).filter(a=>a.length),rng);
  while(chosen.length<o.count&&groups.some(a=>a.length))for(const a of groups)if(a.length&&chosen.length<o.count)chosen.push(a.pop());
 }
 return chosen.map(q=>{const order=shuffle([0,1,2,3],rng);return {...q,options:order.map(i=>q.options[i]),correct:order.indexOf(q.correct)};});
}
export function createGame(input,bank,now=Date.now()){
 const o=settings(input),deck=selectDeck(bank,o);if(!deck.length)throw new Error('Aucune question pour cette sélection.');
 return {phase:'lobby',round:0,players:[],options:o,deck,startedAt:null,deadline:null,createdAt:now,gameId:crypto.randomUUID()};
}
export function joinGame(g,name,id,hash,avatar='castor'){
 name=String(name||'').normalize('NFC').trim().replace(/\s+/g,' ');
 if(!/^[\p{L}\p{N}][\p{L}\p{N} .’'\-]{0,23}$/u.test(name))throw new Error('Entre un nom de 1 à 24 caractères, sans symbole spécial.');
 if(g.players.length>=32)throw new Error('Cette partie a déjà 32 joueurs.');
 if(g.players.some(p=>p.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))throw new Error('Ce nom est déjà utilisé. Ajoute une initiale.');
 if(g.phase==='finished')throw new Error('La partie est terminée. Attends la revanche.');
 avatar=CHARACTERS.some(c=>c.id===avatar)?avatar:'castor';
 g.players.push({id,hash,name,avatar,score:0,correct:0,categories:[],answers:{}});return g;
}
export function authorize(g,actor){
 if(actor?.role==='host'&&(!g.hostHash||actor.hash===g.hostHash))return null;
 const p=actor?.role==='player'&&g.players.find(p=>p.id===actor.id&&p.hash===actor.hash);
 if(!p)throw new Error('Cette connexion a expiré ou ce joueur a été retiré.');return p;
}
function beginQuestion(g,now){
 g.phase='question';g.startedAt=now;g.deadline=g.options.seconds?now+g.options.seconds*1000:null;g.revealedAt=null;g.nextAt=null;
}
export function settle(g,now=Date.now()){
 if(g.phase==='question'&&((g.deadline!==null&&now>=g.deadline)||(g.players.length>0&&g.players.every(p=>p.answers[g.round]))))g.phase='reveal';
 if(g.phase==='reveal'){
  if(!Number.isFinite(g.revealedAt))g.revealedAt=now;
  if(!Number.isFinite(g.nextAt))g.nextAt=g.revealedAt+REVEAL_MS;
  if(now>=g.nextAt){
   if(g.round+1>=g.deck.length){g.phase='finished';g.nextAt=null;}
   else{g.round++;beginQuestion(g,now);}
  }
 }
 return g;
}
export function applyAction(g,actor,action,data={},now=Date.now(),bank=[]){
 const p=authorize(g,actor);
 if(['advance','rematch','kick','close'].includes(action)&&actor.role!=='host')throw new Error('Seul l’hôte peut faire cette action.');
 // Check command position BEFORE settling, so automatic reveal cannot turn
 // a stale reveal command into a second advance.
 if(['advance','rematch'].includes(action)&&(data.expected!==`${g.phase}:${g.round}`||(data.gameId&&data.gameId!==g.gameId)))return settle(g,now);
 if(action==='advance'){
  if(g.phase==='lobby'){
   if(!g.players.length)throw new Error('Il faut au moins un joueur pour commencer.');
   beginQuestion(g,now);
  }else if(g.phase==='question'){g.phase='reveal';}
  else if(g.phase==='reveal'){
   if(g.round+1>=g.deck.length)g.phase='finished';
   else{g.round++;beginQuestion(g,now);}
  }
 }else if(action==='answer'){
  if(!p)throw new Error('Rejoins la partie comme joueur pour répondre.');
  if(!Number.isInteger(data.choice)||data.choice<0||data.choice>3)throw new Error('Cette réponse est invalide.');
  if(data.gameId!==g.gameId)throw new Error('Cette réponse appartient à une autre partie.');
  if(data.round!==g.round)throw new Error('Cette question est déjà terminée.');
  settle(g,now);
  if(data.round!==g.round)return g;
  if(p.answers[g.round])return g;
  if(g.phase!=='question')return g;
  const q=g.deck[g.round],correct=data.choice===q.correct;
  const bonus=g.options.seconds?Math.max(0,Math.min(500,Math.round(500*(1-(now-g.startedAt)/(g.options.seconds*1000))))):0;
  const points=correct?1000+bonus:0;
  p.answers[g.round]={choice:data.choice,correct,points};p.score+=points;
  if(correct){p.correct++;if(!p.categories.includes(q.category))p.categories.push(q.category);}
 }else if(action==='rematch'){
  if(g.phase!=='finished')throw new Error('Termine cette partie avant la revanche.');
  // Keep all rounds already played in this room out of the draw, including earlier rematches.
  const seen=new Set([...(g.seenQuestionIds||[]),...g.deck.map(q=>q.id)]);
  const next=createGame(g.options,bank,now);
  const fresh=selectDeck(bank.filter(q=>!seen.has(q.id)),{...g.options,count:next.deck.length});
  const inNext=new Set(fresh.map(q=>q.id));
  const rest=selectDeck(bank.filter(q=>!inNext.has(q.id)),{...g.options,count:next.deck.length-fresh.length});
  next.deck=[...fresh,...rest];
  if(g.options.difficulty==='progressive')next.deck.sort((a,b)=>a.level-b.level);
  next.seenQuestionIds=[...seen];
  next.players=g.players.map(p=>({...p,score:0,correct:0,categories:[],answers:{}}));next.hostHash=g.hostHash;
  Object.assign(g,next);
 }else if(action==='kick'){
  g.players=g.players.filter(p=>p.id!==data.id);
 }else if(action==='leave'){
  if(p)g.players=g.players.filter(x=>x.id!==p.id);
 }else if(action==='close'){g.phase='closed';}
 else if(action!=='state')throw new Error('Action inconnue.');
 return settle(g,now);
}
export function publicState(g,actor,now=Date.now(),settleTime=true){
 const me=authorize(g,actor);if(settleTime)settle(g,now);
 const reveal=['reveal','finished'].includes(g.phase),q=g.deck[g.round];
 const ranked=g.players.map(p=>{const pending=!reveal&&g.phase==='question'?p.answers[g.round]:null;return {...p,score:p.score-(pending?.points||0),correct:p.correct-(pending?.correct?1:0),categories:reveal||g.phase!=='question'?p.categories:[...new Set(Object.entries(p.answers).filter(([i,a])=>Number(i)<g.round&&a.correct).map(([i])=>g.deck[Number(i)].category))]};}).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fr'));
 const players=ranked.map((p,i)=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,correct:p.correct,categories:p.categories,answered:!!p.answers[g.round],...(reveal?{wasCorrect:p.answers[g.round]?.correct??false,points:p.answers[g.round]?.points??0}:{}),rank:ranked.findIndex(x=>x.score===p.score)+1}));
 const question=g.phase!=='lobby'&&g.phase!=='closed'?{text:q.text,options:q.options,category:q.category,level:q.level,theme:q.theme,...(reveal?{correct:q.correct,explanation:q.explanation,source:q.source}:{} )}:null;
 const a=me?.answers[g.round];
 return {phase:g.phase,round:g.round,total:g.deck.length,options:g.options,serverTime:now,startedAt:g.startedAt,deadline:g.deadline,nextAt:g.phase==='reveal'?g.nextAt??null:null,gameId:g.gameId,players,question,answeredCount:players.filter(p=>p.answered).length,
  me:me?{id:me.id,name:me.name,avatar:me.avatar,score:ranked.find(p=>p.id===me.id).score,choice:a?.choice??null,...(reveal?{points:a?.points??0,wasCorrect:a?.correct??false}:{} )}:null,
  ...(reveal?{distribution:[0,1,2,3].map(i=>g.players.filter(p=>p.answers[g.round]?.choice===i).length)}:{})};
}
