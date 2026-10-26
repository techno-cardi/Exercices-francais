import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('active creation UI preserves every checked group instead of forcing its first group',()=>{
 const state={currentAssignment:{id:null,groups:['31','32']},dashboardGroup:'31'};
 const checks=[{value:'31',checked:true},{value:'32',checked:true}],row={style:{}},summary={textContent:''},hint={hidden:true};
 const settings={open:false,querySelector:selector=>selector==='summary'?summary:{}};
 const nodes={groupChoices:{closest:()=>row,querySelectorAll:()=>checks},workSettings:settings,independentGroupHint:hint};
 const document={getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[]};
 let source=fs.readFileSync(new URL('../app-patch-v10.js',import.meta.url),'utf8');
 source=source.replace('  install();','  window.testEnsureGroups=ensureNewWorkGroupSelect;');
 const window={};vm.runInNewContext(source,{window,document,state});window.testEnsureGroups();
 assert.deepEqual(state.currentAssignment.groups,['31','32']);assert(checks.every(i=>i.checked));
 assert.equal(row.style.display,'');assert.equal(hint.hidden,false);assert.equal(settings.open,true);
});
