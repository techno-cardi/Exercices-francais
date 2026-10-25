import assert from 'node:assert/strict';import {RoomLive} from '../realtime.mjs';
const API='https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/quiz-salon';
async function api(body){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.ok(r.ok,d.error);return d;}
const made=await api({action:'create',options:{count:7,categories:['local'],seconds:0}});assert.equal(made.state.total,7);let live;let changed;
try{
 let joined;const ready=new Promise(r=>joined=r);live=new RoomLive(made.code,()=>changed?.(),connected=>{if(connected)joined();});
 await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('websocket connection timeout')),10000))]);
 let notice;const received=new Promise(r=>changed=r);const start=performance.now();
 const player=await api({action:'join',code:made.code,name:'Direct'});await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(Error('no realtime invalidation')),10000))]);
 const ms=Math.round(performance.now()-start);assert.ok(ms<10000);console.log('PASS: live WebSocket notification after join, measured '+ms+' ms including complete HTTP join request; custom 7-question local deck.');
}finally{live?.stop();await api({action:'close',code:made.code,role:'host',token:made.token});}
