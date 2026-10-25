import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,joinGame,applyAction,publicState} from '../backend/engine.mjs';
import {QUESTIONS} from '../backend/questions.mjs';
const t=1800000000000,host={role:'host',hash:'host'},alice={role:'player',id:'a',hash:'a'},bob={role:'player',id:'b',hash:'b'};
function ready(count=2,seconds=30){const g=createGame({count,seconds},QUESTIONS,t);g.hostHash='host';joinGame(g,'Alice','a','a','renard');joinGame(g,'Bob','b','b','castor');applyAction(g,host,'advance',{expected:'lobby:0',gameId:g.gameId},t);return g;}
const answer=(g,p,choice,now)=>applyAction(g,p,'answer',{round:g.round,gameId:g.gameId,choice},now);
test('all answers reveal winners only after correction and advance after 8 seconds',()=>{
 const g=ready();answer(g,alice,g.deck[0].correct,t+1000);
 assert.equal(publicState(g,host,t+1000).players.find(p=>p.id==='a').wasCorrect,undefined);
 answer(g,bob,(g.deck[0].correct+1)%4,t+2000);
 const view=publicState(g,host,t+2000);assert.equal(view.nextAt,t+10000);
 assert.equal(view.players.find(p=>p.id==='a').wasCorrect,true);assert.ok(view.players.find(p=>p.id==='a').points>=1000);
 assert.equal(view.players.find(p=>p.id==='b').wasCorrect,false);
 applyAction(g,bob,'state',{},t+9999);assert.equal(g.phase,'reveal');
 applyAction(g,bob,'state',{},t+10000);assert.equal(g.phase,'question');assert.equal(g.round,1);assert.equal(g.startedAt,t+10000);assert.equal(g.deadline,t+40000);
 applyAction(g,host,'advance',{expected:'reveal:0',gameId:g.gameId},t+10001);assert.equal(g.phase,'question');assert.equal(g.round,1);
 assert.equal(publicState(g,host,t+10001).players.find(p=>p.id==='a').wasCorrect,undefined);
});
test('deadline opens correction once, repeated polls do not restart its timer',()=>{
 const g=ready();applyAction(g,alice,'state',{},t+30000);assert.equal(g.phase,'reveal');assert.equal(g.nextAt,t+38000);
 applyAction(g,bob,'state',{},t+35000);assert.equal(g.nextAt,t+38000);
 applyAction(g,alice,'state',{},t+60000);assert.equal(g.round,1);assert.equal(g.startedAt,t+60000);
});
test('last correction finishes automatically, including legacy rooms without reveal timestamp',()=>{
 const g=ready(1);g.phase='reveal';delete g.revealedAt;delete g.nextAt;
 applyAction(g,alice,'state',{},t+5000);assert.equal(g.nextAt,t+13000);
 applyAction(g,bob,'state',{},t+13000);assert.equal(g.phase,'finished');assert.equal(g.round,0);assert.equal(g.nextAt,null);
});
test('late answer after correction expiry cannot answer the upcoming question',()=>{
 const g=ready();answer(g,alice,g.deck[0].correct,t+100);answer(g,bob,g.deck[0].correct,t+200);
 applyAction(g,alice,'answer',{round:0,gameId:g.gameId,choice:g.deck[0].correct},t+9000);
 assert.equal(g.round,1);assert.equal(g.players[0].answers[1],undefined);assert.equal(g.phase,'question');
});
