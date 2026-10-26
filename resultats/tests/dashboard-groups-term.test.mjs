import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function setup(){
 const state={groupStats:{'77':12,'A2':10},teacherAssignments:[{groups:['OLD']}],dashboardGroup:'gone'};
 const context=vm.createContext({state});
 const start=source.indexOf('function dashboardGroups(');assert.notEqual(start,-1,'group lifecycle must use dynamic data');
 vm.runInContext(source.slice(start,source.indexOf('async function refreshTeacherData(')),context);return context;
}
test('known navigation groups retain history but only active roster groups are offered for new work',()=>{
 const c=setup();assert.deepEqual(Array.from(c.dashboardGroups()),['77','A2','OLD']);assert.deepEqual(Array.from(c.activeAssignmentGroups()),['77','A2']);
 c.state.groupStats={};c.state.teacherAssignments=[];assert.deepEqual(Array.from(c.dashboardGroups()),[]);assert.deepEqual(Array.from(c.activeAssignmentGroups()),[]);
});
test('dashboard and assignment list use selected term and contain no default group 51',()=>{
 assert.match(source.slice(source.indexOf('function renderDashboard('),source.indexOf('function assignmentCards(')),/state.dashboardTerm/);
 assert.match(source.slice(source.indexOf('function renderAssignmentList('),source.indexOf('async function newAssignment(')),/state.dashboardTerm/);
 assert.doesNotMatch(source,/dashboardGroup[^\n]*\|\| "51"/);
});
