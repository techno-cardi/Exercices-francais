(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CardinalMozaikImportCore=api;})(globalThis,function(){
 'use strict';
 const text=v=>String(v==null?'':v).trim();
 const scopeKeys=['groupCode','schoolYear','schoolId','subjectId','mozaikGroupId'];
 const normalized=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
 const scalar=v=>v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string';
 // Normalize DB values independently of the raw remote metadata. In particular,
 // Number('') and Number(null) must never manufacture a zero.
 const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim())&&Number.isFinite(Number(v))?Number(v):null;
 function calendarDate(value){
  if(!text(value))return null;
  const date=text(value),match=/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(date);
  if(!match||!Number.isFinite(Date.parse(date))||new Date(match[1]+'T00:00:00Z').toISOString().slice(0,10)!==match[1])invalid('Date Mozaïk invalide. Vérifie cette activité avant de l’importer.');
  return match[1];
 }
 const sameScope=(a,b)=>scopeKeys.every(k=>text(a[k])===text(b[k]));
 const single=(a,g)=>Array.isArray(a.group_codes)&&a.group_codes.length===1&&a.group_codes[0]===g;
 function invalid(message){throw new Error(message);}
 function buildMetadataPreview(input){
  const scope=Object.fromEntries(scopeKeys.map(k=>[k,text(input.scope?.[k])]));
  if(scopeKeys.some(k=>!scope[k]))invalid('Portée Mozaïk incomplète : groupe, année, école et matière sont obligatoires.');
  if(!Array.isArray(input.activities)||input.activities.length>1000)invalid('Liste des travaux Mozaïk invalide.');
  const selections=input.selections||[];
  if(!Array.isArray(selections)||selections.length>1000)invalid('Sélection invalide.');
  if(selections.length&&input.complete!==true)invalid('La liste Mozaïk est incomplète. Recharge-la avant de confirmer.');
  const assignments=(input.assignments||[]).filter(a=>single(a,scope.groupCode));
  const links=(input.links||[]).filter(l=>sameScope(l,scope));
  const ids=new Set(),rows=[],plans=[],counts={linked:0,already_exists:0,missing:0,ambiguous:0};
  for(const raw of input.activities){
   if(!sameScope(raw,scope))invalid('Une activité ne correspond pas à la portée Mozaïk demandée.');
   const activityId=text(raw.activityId);if(!activityId||ids.has(activityId))invalid('Identifiant Mozaïk manquant ou dupliqué.');ids.add(activityId);
   // Allowlist scalar metadata: no bearer token, student record or result collection can enter a stored plan.
   const metadata={...scope,activityId};
   for(const key of ['planningId','title','maxScore','weight','weightCategoryId','activityDate','term','competenceCode','competenceKind','activityType','reportCardEnabled','resultsVisible','showInSchedule','homework','period','evaluated','instructions'])if(Object.hasOwn(raw,key)&&scalar(raw[key]))metadata[key]=raw[key];
   metadata.title=text(metadata.title).slice(0,140);
   const linked=links.filter(l=>text(l.activityId)===activityId);
   const historical=(input.links||[]).filter(l=>text(l.activityId)===activityId&&text(l.groupCode)===scope.groupCode&&scopeKeys.some(k=>!text(l[k])));
   const candidates=assignments.filter(a=>normalized(a.title)===normalized(metadata.title)&&metadata.title).map(a=>({id:a.id,title:a.title,activityDate:a.activity_date||null,term:a.term||null,maxScore:a.max_score??null}));
   const exact=linked.length===1&&assignments.some(a=>a.id===linked[0].assignmentId);
   const status=historical.length?'ambiguous':linked.length?(exact?'linked':'ambiguous'):candidates.length>1?'ambiguous':candidates.length===1?'already_exists':'missing';
   counts[status]++;
   rows.push({activityId,title:metadata.title,status,assignmentId:exact?linked[0].assignmentId:null,candidates,selectable:!linked.length&&!historical.length,metadata});
  }
  const selected=new Set(),destinations=new Set();
  for(const selection of selections){
   const id=text(selection.activityId),row=rows.find(r=>r.activityId===id);
   if(!row||selected.has(id)||!row.selectable)invalid('Cette activité est déjà liée ou la sélection est invalide.');selected.add(id);
   const m=row.metadata;
   let assignmentId=null,beforeSnapshot=null,newAssignment=null,assignmentPatch={};
   if(selection.mode==='associate'){
    assignmentId=text(selection.assignmentId);
    const assignment=assignments.find(a=>a.id===assignmentId);
    if(!assignment||destinations.has(assignmentId))invalid('La destination doit être un travail indépendant du groupe.');
    if((input.links||[]).some(l=>l.assignmentId===assignmentId&&l.groupCode===scope.groupCode))invalid('La destination possède déjà un lien Mozaïk. Vérifie cette association.');
    beforeSnapshot=input.snapshots?.[assignmentId];
    if(!beforeSnapshot||!single(beforeSnapshot.assignment,scope.groupCode))invalid('La destination doit être vérifiée à nouveau.');
    destinations.add(assignmentId);
    assignmentPatch={source_metadata:{...(beforeSnapshot.assignment.source_metadata||{}),mozaik:m}};
   }else if(selection.mode==='create'){
    if(!m.title)invalid('Le titre Mozaïk est manquant.');
    const rawMax=numeric(m.maxScore),rawWeight=numeric(m.weight);
    const max=rawMax!==null&&rawMax>0?rawMax:null;
    const weight=rawWeight!==null&&rawWeight>=0&&rawWeight<=100?rawWeight:null;
    newAssignment={title:m.title,max_score:max,weight,import_state:max===null?'metadata_only':'ready',published:false,source_metadata:{mozaik:m}};
    const fields={activityDate:'activity_date',term:'term',competenceCode:'mozaik_competence_code',competenceKind:'mozaik_competence_kind',activityType:'activity_type',reportCardEnabled:'report_card_enabled',resultsVisible:'mozaik_results_visible',showInSchedule:'mozaik_show_in_schedule',homework:'mozaik_homework',period:'mozaik_period',instructions:'instructions'};
    for(const [key,column]of Object.entries(fields)){
     let value=m[key];
     if(key==='term'||key==='period')value=numeric(value);
     if(key==='activityDate')value=calendarDate(value);
     if(value===undefined||value===null)continue;
     if(['reportCardEnabled','resultsVisible','showInSchedule','homework'].includes(key)&&typeof value!=='boolean')continue;
     if(key==='term'&&![1,2,3].includes(value))continue;
     if(key==='period'&&!(Number.isInteger(value)&&value>=1&&value<=20))continue;
     if(key==='activityDate'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))continue;
     if(key==='competenceKind'&&!['lecture','ecriture','oral'].includes(value))continue;
     newAssignment[column]=value;
    }
   }else invalid('Choisis créer ou associer pour chaque activité.');
   plans.push({assignmentId,beforeSnapshot,newAssignment,assignmentPatch,groupCode:scope.groupCode,writes:[],mozaikLink:{activity_id:id,group_code:scope.groupCode,school_year:scope.schoolYear,school_id:scope.schoolId,subject_id:scope.subjectId,mozaik_group_id:scope.mozaikGroupId,planning_id:m.planningId??null,competence_code:m.competenceCode??null},summary:{metadataOnly:true,activityId:id}});
  }
  return{scope,complete:input.complete===true,rows,counts,plans};
 }
 return{buildMetadataPreview};
});


