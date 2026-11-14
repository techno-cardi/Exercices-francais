const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function setup(){
 const els=new Map();const $=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',innerHTML:''});return els.get(id)};
 const c={state:{teacherToken:'test-token',schoolYear:2026,schoolYearRevision:1,dashboardGroup:'32',dashboardTerm:'1',teacherAssignments:[],groupStats:{}},$,window:{},TEACHER_ENDPOINT:'test',localStorage:{getItem:()=>null},document:{querySelector:()=>null},assignmentCards:rows=>rows.map(a=>a.id).join(','),wireAssignmentCards(){},renderDashboard(){c.dashboard=(c.state.teacherAssignments||[]).map(a=>a.id).join(',')},api:async()=>({assignments:[{id:'new',title:'Nouveau travail',groups:['32'],term:1,competenceKind:'lecture'}],groups:{'32':1}})};
 vm.createContext(c);
 vm.runInContext(src.slice(src.indexOf('async function refreshTeacherData('),src.indexOf('async function loadTeacherDashboard(')),c);
 vm.runInContext(src.slice(src.indexOf('function renderAssignmentList('),src.indexOf('["assignmentSearch", "assignmentCompetenceFilter"]')),c);
 return {c,$};
}
test('confirmed import can refresh catalogue and both card views without reloading',async()=>{const {c,$}=setup();assert.equal(await c.refreshTeacherData({renderViews:true}),true);assert.equal($('assignmentList').innerHTML,'new');assert.equal(c.dashboard,'new');});
test('import refresh retains group, term, search and competency filters',async()=>{const {c,$}=setup();$('assignmentSearch').value='autre';$('assignmentCompetenceFilter').value='oral';await c.refreshTeacherData({renderViews:true});assert.equal($('assignmentSearch').value,'autre');assert.equal($('assignmentCompetenceFilter').value,'oral');assert.equal(c.state.dashboardGroup,'32');assert.equal(c.state.dashboardTerm,'1');assert.equal($('assignmentList').innerHTML,'');});
test('catalogue-only reads do not redraw editors or views',async()=>{const {c,$}=setup();$('assignmentList').innerHTML='untouched';await c.refreshTeacherData();assert.equal($('assignmentList').innerHTML,'untouched');assert.equal(c.dashboard,undefined);});
test('a late pre-import response cannot erase the refreshed catalogue',async()=>{const {c,$}=setup();let old; c.api=()=>new Promise(r=>old=r);const pending=c.refreshTeacherData({renderViews:true});c.api=async()=>({assignments:[{id:'new',title:'New',groups:['32'],term:1}]});await c.refreshTeacherData({renderViews:true});old({assignments:[]});assert.equal(await pending,false);assert.equal(c.state.teacherAssignments[0].id,'new');assert.equal($('assignmentList').innerHTML,'new');});
for(const kind of ['session','year'])test('late catalogue from previous '+kind+' does not redraw',async()=>{const {c,$}=setup();let finish;c.api=()=>new Promise(r=>finish=r);const pending=c.refreshTeacherData({renderViews:true});if(kind==='session')c.state.teacherToken='new-session';else{c.state.schoolYear=2025;c.state.schoolYearRevision++}finish({assignments:[]});assert.equal(await pending,false);assert.equal(c.dashboard,undefined);});
