// Run: node resultats/tests/mozaik-weight-choice.test.cjs
// No network, no student records, no Mozaik writes.
'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

class FakeEl {
  constructor(tag){
    this.tag=tag;this.children=[];this.handlers={};this.style={};
    this.disabled=false;this.checked=false;this.open=false;this.parent=null;this.textContent='';
  }
  append(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}}
  addEventListener(name,handler){this.handlers[name]=handler;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  querySelector(selector){
    const find=node=>{
      if(selector==='input:checked'&&node.tag==='input'&&node.checked)return node;
      for(const child of node.children){const found=find(child);if(found)return found;}
      return null;
    };
    return find(this);
  }
}
function setup(){
  const root=new FakeEl('body');
  const doc={body:root,createElement:tag=>new FakeEl(tag)};
  const win={};
  const source=fs.readFileSync(path.join(__dirname,'../assignment-actions.js'),'utf8');
  new Function('window','document',source)(win,doc);
  return {root,api:win.CardinalAssignmentActions};
}
function walk(node,all=[]){all.push(node);for(const c of node.children)walk(c,all);return all;}

for(const isNew of [true,false]){
  test('Explicit group weight choice: '+(isNew?'new activity':'linked activity'),async()=>{
    const {root,api}=setup();
    const operation=api.chooseMozaikWeightSource({
      groupCode:'32',title:'Travail fictif',gestionWeight:39,gestionMaxScore:70,
      mozaikWeight:45,mozaikMaxScore:100,isNew
    });
    const nodes=walk(root);
    const choices=nodes.filter(node=>node.tag==='input'&&node.type==='radio');
    const next=nodes.find(node=>node.tag==='button'&&node.textContent==='Vérifier l’aperçu');
    assert.equal(choices.length,2);
    assert.equal(choices[0].value,'gestion');
    assert.equal(choices[1].value,'mozaik');
    assert.equal(choices[1].disabled,isNew);
    assert.equal(next.disabled,true,'No implicit choice');
    assert.equal(choices.some(c=>c.checked),false);
    const visibleText=nodes.map(node=>node.textContent||'').join(' ');
    assert.match(visibleText,/39 %/);
    assert.match(visibleText,/100/);
    choices[0].checked=true;
    const form=choices[0].parent.parent;
    form.handlers.change();
    assert.equal(next.disabled,false);
    next.onclick();
    assert.equal(await operation,'gestion');
    assert.equal(root.children.length,0,'Dialog cleaned after selection');
  });
}
test('Backend source is explicit and scoped to a newly prepared job',()=>{
  const content=fs.readFileSync(path.join(__dirname,'../../supabase/functions/mozaik-sync/index.ts'),'utf8');
  assert.match(content,/weightSource=body.weightSource==null/);
  assert.match(content,/\["legacy","gestion","mozaik"\]/);
  assert.match(content,/maxScore,weightSource,resultsVisible/);
  assert.match(content,/weightSource==="mozaik"&&!/);
});
test('Frontend rejects prior/stale destination metadata and uses exact group',()=>{
  const v14=fs.readFileSync(path.join(__dirname,'../app-patch-v14.js'),'utf8');
  assert.match(v14,/destinationInfo\.groupCode/);
  assert.match(v14,/destinationInfo\.assignmentId/);
  assert.match(v14,/destinationInfo\.capturedAt/);
  assert.match(v14,/weightSource:job\.payload\.assignment\?\.weightSource/);
  assert.match(v14,/action:'cancelUnwritten'/);
});

test('The backend validates the chosen authority, not a stale Gestion weight',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../supabase/functions/mozaik-sync/index.ts'),'utf8');
  // Evaluate the actual server-side guard with fixture values, not an independent rewrite.
  const guard=source.split(/\\r?\\n/).find(line=>line.includes('fail("Entre une pondération entre 0 et 100.")'));
  assert.equal(typeof guard,'string','Server weight guard must exist and be executable');
  const validate=new Function('weight','weightSource','s','a','fail',guard);
  const check=(weightSource,weight,reportCardEnabled)=>{
    try{
      validate(weight,weightSource,{reportCardEnabled},{source_metadata:null},()=>{throw new Error('rejected')});
      return true;
    }catch{return false;}
  };
  assert.equal(check('mozaik',null,true),true,'Mozaik reference never depends on Gestion weight presence');
  assert.equal(check('mozaik',-3,true),true,'Mozaik reference does not reuse invalid Gestion weight');
  assert.equal(check('gestion',null,true),false,'Gestion report-card activity needs its own weight');
  assert.equal(check('gestion',39,true),true,'Valid Gestion weight accepted');
  assert.equal(check('gestion',0,true),true,'Zero is a valid explicit weight');
  assert.equal(check('legacy',-3,true),false,'Prior legacy validation unchanged');
  assert.equal(check('legacy',null,true),false,'Prior legacy missing-weight protection unchanged');
  assert.equal(check('legacy',null,false),true,'Non-bulletin work stays supported');
});
