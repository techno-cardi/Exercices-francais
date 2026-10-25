// Explicit live integration test; creates only disposable Quiz de salon rooms.
import assert from 'node:assert/strict';import {QUESTIONS} from '../backend/questions.mjs';
const API='https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/quiz-salon';
async function api(body,expected=200){const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,expected,JSON.stringify({action:body.action,error:data.error}));return data;}
const made=await api({action:'create',options:{count:10,seconds:0,difficulty:'mix'}});const host={code:made.code,token:made.token,role:'host'};
const cmd=(action,data,expected=200,who=host)=>api({...who,action,data},expected);
await api({action:'state',code:made.code},403);
await cmd('advance',{expected:'lobby:0'},400);
const joined=await Promise.all(Array.from({length:16},(_,i)=>api({action:'join',code:made.code,name:'Essai '+String(i+1).padStart(2,'0')})));
const players=joined.map(p=>({code:made.code,token:p.token,id:p.id,role:'player'}));
let snap=(await cmd('state')).state;assert.equal(snap.players.length,16);await cmd('advance',{expected:'lobby:0',gameId:snap.gameId},400,players[0]);
snap=(await cmd('advance',{expected:'lobby:0',gameId:snap.gameId})).state;
for(let round=0;round<10;round++){
 assert.equal(snap.phase,'question');assert.equal(snap.round,round);assert.equal(snap.question.correct,undefined);
 const original=QUESTIONS.find(q=>q.text===snap.question.text),answer=snap.question.options.indexOf(original.options[original.correct]);
 // One answer then a reload: no score/correct answer leak, persisted choice.
 if(round===0){const first=(await cmd('answer',{round,choice:answer,gameId:snap.gameId},200,players[0])).state;assert.equal(first.me.score,0);assert.equal(first.question.correct,undefined);assert.equal((await cmd('state',{},200,players[0])).state.me.choice,answer);}
 const results=await Promise.all(players.map(player=>cmd('answer',{round,choice:answer,gameId:snap.gameId},200,player)));
 snap=(await cmd('state')).state;assert.equal(snap.phase,'reveal');assert.equal(snap.answeredCount,16);assert.equal(snap.question.correct,answer);assert.ok(snap.players.every(p=>p.score===(round+1)*1000));
 const duplicate=(await cmd('answer',{round,choice:answer,gameId:snap.gameId},200,players[0])).state;assert.equal(duplicate.me.score,(round+1)*1000);
 const next={expected:`reveal:${round}`,gameId:snap.gameId};snap=(await cmd('advance',next)).state;
 if(round<9){assert.equal(snap.round,round+1);const repeated=(await cmd('advance',next)).state;assert.equal(repeated.phase,'question');assert.equal(repeated.round,round+1);await cmd('answer',{round,choice:answer,gameId:snap.gameId},400,players[0]);}
}
assert.equal(snap.phase,'finished');assert.ok(snap.players.every(p=>p.score===10000&&p.rank===1));
const newGame=(await cmd('rematch',{expected:`finished:${snap.round}`,gameId:snap.gameId})).state;assert.equal(newGame.phase,'lobby');assert.equal(newGame.players.length,16);assert.ok(newGame.players.every(p=>p.score===0));assert.equal((await cmd('state',{},200,players[3])).state.me.name,'Essai 04');
await cmd('close');await cmd('state',{},410,players[0]);
console.log('PASS: live API, 16 concurrent players, 160 answers, 10 rounds, race protection, auth, masked scores, reconnect, tie, rematch, close.');
