import {test} from 'node:test';import assert from 'node:assert/strict';
import {winnerPage} from '../results.mjs';
test('all 32 winners appear within the 8-second TV correction without remote scrolling',()=>{
 const shown=new Set();for(let elapsed=0;elapsed<8000;elapsed+=200){const page=winnerPage(32,18000,10000+elapsed);for(let i=page*8;i<Math.min(32,(page+1)*8);i++)shown.add(i);}
 assert.equal(shown.size,32);assert.equal(winnerPage(32,18000,10000),0);assert.equal(winnerPage(32,18000,18000),3);
});
test('small winner lists and legacy corrections stay on their first page',()=>{for(const n of [0,1,8])assert.equal(winnerPage(n,18000,17000),0);assert.equal(winnerPage(32,null,17000),0);});
