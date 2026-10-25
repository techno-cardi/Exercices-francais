// Real disposable room: no host action after initial start.
import assert from 'node:assert/strict';
import {QUESTIONS} from '../backend/questions.mjs';
const API='https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/quiz-salon';
async function api(body,status=200){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const made=await api({action:'create',options:{count:2,seconds:0,difficulty:'1'}}),host={code:made.code,token:made.token,role:'host'};
const entries=await Promise.all(['Alice test','Bob test','Chloé test'].map(name=>api({action:'join',code:made.code,name,avatar:'renard'})));
const players=entries.map(p=>({code:made.code,token:p.token,id:p.id,role:'player'}));
const cmd=(who,action,data)=>api({...who,action,data});
let s=(await cmd(host,'advance',{expected:'lobby:0',gameId:made.state.gameId})).state;
for(let round=0;round<2;round++){
 assert.equal(s.round,round);assert.equal(s.phase,'question');assert.ok(s.players.every(p=>p.wasCorrect===undefined));
 const q=QUESTIONS.find(q=>q.text===s.question.text);assert.ok(q);const correct=s.question.options.indexOf(q.options[q.correct]);
 await cmd(players[0],'answer',{gameId:s.gameId,round,choice:correct});
 const hidden=(await cmd(players[1],'state')).state;assert.equal(hidden.question.correct,undefined);assert.ok(hidden.players.every(p=>p.wasCorrect===undefined));
 await Promise.all(players.slice(1).map((p,i)=>cmd(p,'answer',{gameId:s.gameId,round,choice:i===0?(correct+1)%4:correct})));
 s=(await cmd(host,'state')).state;assert.equal(s.phase,'reveal');assert.equal(s.players.filter(p=>p.wasCorrect).length,2);assert.ok(s.players.filter(p=>p.wasCorrect).every(p=>p.points===1000));assert.ok(s.nextAt>s.serverTime&&s.nextAt-s.serverTime<=8000);
 const nextAt=s.nextAt;
 await new Promise(r=>setTimeout(r,Math.max(0,nextAt-Date.now()+100)));
 const checks=await Promise.all(players.map(p=>cmd(p,'state')));
 for(const result of checks){assert.equal(result.state.round,round===0?1:1);assert.equal(result.state.phase,round===0?'question':'finished');}
 s=(await cmd(host,'state')).state;
}
assert.equal(s.phase,'finished');assert.ok(s.players.filter(p=>p.score===2000).length===2);
await cmd(host,'close');console.log('PASS: live automatic 2 rounds, 3 players, masked winners until reveal, common 8-second timer, simultaneous auto progression, automatic finale.');
