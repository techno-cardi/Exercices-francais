import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('group controls clear on empty data and new works exclude historical-only groups',()=>{
 let known=['77','OLD'],active=['77'],removed=0;
 const filter={value:'OLD',innerHTML:'old',disabled:false},choices={innerHTML:'old',querySelectorAll:()=>[]};
 const state={dashboardGroup:'OLD',currentAssignment:{id:null,groups:['77']}};
 const label={textContent:'Groupes',insertAdjacentElement(){}};
 const document={querySelector:()=>({querySelectorAll:s=>s==='.group-nav'?[{remove(){removed++;}}]:[label]}),getElementById:id=>id==='assignmentGroupFilter'?filter:id==='groupChoices'?choices:null,createElement:()=>({dataset:{},insertAdjacentElement(){}})};
 const window={addEventListener(){}};const localStorage={setItem(){}};
 let source=fs.readFileSync(new URL('../app-patch-v08.js',import.meta.url),'utf8');
 source=source.slice(0,source.lastIndexOf('  ensureGlobalImportPatch();'))+'window.rebuild=rebuildGroupUi;})();';
 vm.runInNewContext(source,{window,state,document,localStorage,dashboardGroups:()=>known,activeAssignmentGroups:()=>active});
 window.rebuild();assert.match(filter.innerHTML,/OLD/);assert.match(choices.innerHTML,/77/);assert.doesNotMatch(choices.innerHTML,/OLD/);
 known=[];active=[];window.rebuild();assert.equal(filter.innerHTML,'');assert.equal(filter.value,'');assert.equal(filter.disabled,true);assert.equal(choices.innerHTML,'');assert.equal(state.dashboardGroup,'');assert.equal(removed,2);
});
test('new-work layout patch cannot restore historical-only groups as creation choices',()=>{
 const source=fs.readFileSync(new URL('../app-patch-v09.js',import.meta.url),'utf8');
 const choices={innerHTML:'old'};const state={currentAssignment:{id:null,groups:['77']}};
 const context=vm.createContext({state,document:{getElementById:()=>choices},knownGroups:()=>['77','OLD'],activeAssignmentGroups:()=>['77'],escAttr:String});
 vm.runInContext(source.slice(source.indexOf('  function renderAllGroupChoices('),source.indexOf('  function sameLevelCandidates(')),context);
 context.renderAllGroupChoices();assert.match(choices.innerHTML,/77/);assert.doesNotMatch(choices.innerHTML,/OLD/);
 state.currentAssignment={id:'history',groups:['OLD']};context.renderAllGroupChoices();assert.match(choices.innerHTML,/OLD/);assert.match(choices.innerHTML,/disabled/);
});
