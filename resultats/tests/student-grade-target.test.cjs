const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(){
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),a=source.indexOf('let studentTargetRevision ='),b=source.indexOf('async function refreshTeacherData()',a);
 assert.ok(a>=0&&b>a,'Targeted student navigation must exist');
 const state={teacherToken:'t',teacherSection:'overview',currentAssignment:null,currentStudents:[],detailGroup:'31'};
 const fields={studentSearch:{value:'Other student'},gradeFilter:{value:'failures'},detailGroupSelect:{value:'31'}};
 const input={disabled:false,focus(){this.focused=true;},select(){this.selected=true;},setAttribute(){}};
 const row={dataset:{email:'target@test.invalid'},classList:{add(){},remove(){}},querySelector:()=>input,scrollIntoView(){this.scrolled=true;}};
 fields.studentRows={querySelectorAll:()=>[row]};let renders=0;const opens=[];
 const c=vm.createContext({state,$:id=>fields[id],notify(){},setGroupRoute(){},activateAssignmentGroup(){},renderGradeRows(){renders++;},openAssignment:()=>new Promise(resolve=>opens.push(resolve))});
 vm.runInContext(source.slice(a,b),c);
 function loaded(id='work'){state.currentAssignment={id,groups:['31']};state.currentStudents=[{email:'target@test.invalid',name:'Target Student',group:'31'}];state.teacherSection='detail';}
 return{state,fields,input,row,opens,loaded,run:c.openAssignmentStudent,get renders(){return renders;}};
}
test('opens the requested work, clears hiding filters and focuses the exact student grade without writing',async()=>{
 const h=harness(),request=h.run('work','target@test.invalid');h.loaded();h.opens[0](true);assert.equal(await request,true);
 assert.equal(h.fields.studentSearch.value,'');assert.equal(h.fields.gradeFilter.value,'all');assert.equal(h.input.focused,true);assert.equal(h.input.selected,true);assert.equal(h.row.scrolled,true);assert.equal(h.renders,1);
});
test('cancelled or superseded navigation never focuses the old target',async()=>{
 const h=harness(),first=h.run('work','target@test.invalid'),second=h.run('other','target@test.invalid');h.loaded('other');h.opens[1](true);assert.equal(await second,true);h.input.focused=false;h.opens[0](true);assert.equal(await first,false);assert.equal(h.input.focused,false);
});
test('missing student and archived disabled field cannot focus or edit another student',async()=>{
 const h=harness(),request=h.run('work','unknown@test.invalid');h.loaded();h.opens[0](true);assert.equal(await request,false);assert.equal(h.input.focused,undefined);
 const r=h.run('work','target@test.invalid');h.loaded();h.input.disabled=true;h.opens[1](true);await r;assert.equal(h.input.focused,undefined);
});
