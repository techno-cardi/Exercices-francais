const test=require('node:test'),assert=require('node:assert/strict');
try{require('../overview-editor.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const input=value=>({value,disabled:false,classList:{add(){},remove(){}},dataset:{},setAttribute(){}});
function setup(save){assert.ok(globalThis.CardinalOverviewEditor);const changes=[];const editor=globalThis.CardinalOverviewEditor.create({save,parse:(v,max)=>{const n=v===''?null:Number(v.replace(',','.'));if(n!==null&&(!Number.isFinite(n)||n<0||n>max))throw Error('Hors barème');return{grade:n,rawGrade:n,text:String(v)};},onSaved:(cell,grade)=>{cell.result.grade=grade;changes.push(grade);},onState(){}});return{editor,changes};}
const cell=()=>({assignment:{id:'a',maxScore:20},student:{email:'s'},result:{grade:10}});
test('serializes distinct cell writes, deduplicates blur/Enter and preserves zero',async()=>{
 let finish;const calls=[];const h=setup(async(c,p)=>{calls.push(p.grade);if(p.grade===0)await new Promise(r=>finish=r);});
 const i=input('10'),j=input('10'),a=cell(),b=cell();h.editor.track(i,a);h.editor.track(j,b);i.value='0';j.value='12';
 const first=h.editor.commit(i),duplicate=h.editor.commit(i),second=h.editor.commit(j);assert.equal(j.disabled,true);await new Promise(r=>setImmediate(r));assert.deepEqual(calls,[0]);finish();await Promise.all([first,duplicate,second]);assert.deepEqual(calls,[0,12]);assert.equal(a.result.grade,0);
});
test('unchanged formatted value does not rewrite precise stored grade',async()=>{
 let count=0;const h=setup(async()=>count++),i=input('10,123'),c=cell();c.result.grade=10.123456;h.editor.track(i,c);await h.editor.commit(i);assert.equal(count,0);assert.equal(c.result.grade,10.123456);
});
test('failed and invalid edits preserve typed value and prevent silent navigation',async()=>{
 const h=setup(async()=>{throw Error('Conflit');}),i=input('10'),c=cell();h.editor.track(i,c);i.value='12';assert.equal(await h.editor.commit(i),false);assert.equal(i.value,'12');assert.equal(c.result.grade,10);assert.equal(await h.editor.flush(),false);assert.equal(h.editor.hasUnsaved(),true);
});
test('read-only years never issue writes',async()=>{
 let count=0;const h=setup(async()=>count++),i=input('10'),c=cell();c.readOnly=true;h.editor.track(i,c);i.value='12';assert.equal(await h.editor.commit(i),false);assert.equal(count,0);
});
test('disabling a focused field cannot reenter and duplicate its save',async()=>{
 let count=0,reentered=false;const h=setup(async()=>count++),i=input('10'),c=cell();h.editor.track(i,c);i.value='12';
 Object.defineProperty(i,'disabled',{set(value){if(value&&!reentered){reentered=true;h.editor.commit(i);}},get(){return false;}});
 await h.editor.commit(i);assert.equal(count,1);
});
