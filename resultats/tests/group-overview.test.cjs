const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(){
 const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const elements={};const listeners={};const pending=[];
 const get=id=>elements[id]||= {value:'all',innerHTML:'',textContent:'',querySelectorAll:()=>[]};
 const state={schoolYear:2026,dashboardGroup:'31',teacherToken:'token',teacherSection:'overview',passingThreshold:60};
 const c=vm.createContext({window:{addEventListener:(type,fn)=>listeners[type]=fn},document:{getElementById:get},state,TEACHER_ENDPOINT:"synthetic",localStorage:{setItem(){}},dashboardGroups:()=>['31','32'],selectDashboardGroup(){},openAssignment(){},api:()=>new Promise(resolve=>pending.push(resolve))});
 vm.runInContext(app.slice(app.indexOf('function formatNumber('),app.indexOf('function competenceLabel('))+app.slice(app.indexOf('function gradePercentage('),app.indexOf('function passingThreshold(')),c);
 vm.runInContext(fs.readFileSync(path.join(root,'group-overview.js'),'utf8'),c);
 return{view:c.window.CardinalGroupOverview,state,elements,get,pending,listeners};
}
const input={assignments:[{id:'a',title:'Lecture <test>',maxScore:20,term:1},{id:'b',title:'Écriture',maxScore:10,term:2}],students:[{email:'b',name:'Éva Zèbre',lastName:'Zèbre',firstName:'Éva',results:{a:{grade:12},b:{grade:null}}},{email:'a',name:'Alice Alpha',lastName:'Alpha',firstName:'Alice',results:{a:{grade:0},b:{grade:5.9999}}},{email:'c',name:'Sans résultat',results:{}}]};
test('overview marks individual failures red and distinguishes zero, missing and unassigned',()=>{
 const {view}=harness(),out=view.tableMarkup(input);
 assert.equal(out.failures,2);assert.equal(out.ungraded,1);assert.equal((out.html.match(/class="overview-failure"/g)||[]).length,2);
 assert.match(out.html,/>0 %</);assert.match(out.html,/Non noté/);assert.match(out.html,/Non inscrit à ce travail/);
 assert.ok(out.html.indexOf('Alpha, Alice')<out.html.indexOf('Zèbre, Éva'));assert.match(out.html,/Lecture &lt;test&gt;/);
 assert.doesNotMatch(out.html,/60 %<span class="overview-cell-note">Échec/);
});
test('all steps by default; points, term, search and custom threshold remain independent',()=>{
 const {view}=harness();assert.equal(view.tableMarkup(input).workCount,2);
 const out=view.tableMarkup(input,{term:2,scale:'points',search:'eva',threshold:50});assert.equal(out.studentCount,1);assert.equal(out.workCount,1);assert.equal(out.failures,0);
 assert.match(view.tableMarkup(input,{scale:'points'}).html,/0 \/ 20/);
 assert.equal(view.tableMarkup(input,{threshold:0}).failures,0);
});
test('old year response cannot overwrite the current overview',async()=>{
 const h=harness();const request=h.view.show();h.state.schoolYear=2027;h.listeners['cardinal-year-changed']();h.pending[0](input);await request;
 assert.doesNotMatch(h.get('overviewContent').innerHTML,/overview-table/);
});
test('old group response cannot overwrite a newly selected group',async()=>{
 const h=harness();const first=h.view.show();h.state.dashboardGroup='32';const second=h.view.show();
 h.pending[1]({...input,assignments:[{id:'new',title:'Groupe 32',maxScore:10}],students:[]});await second;
 h.pending[0](input);await first;assert.match(h.get('overviewContent').innerHTML,/Groupe 32/);assert.doesNotMatch(h.get('overviewContent').innerHTML,/Lecture/);
});

