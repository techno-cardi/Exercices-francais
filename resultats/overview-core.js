(function(root){
 'use strict';
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const groups=[['lecture','Lire'],['ecriture','Écrire'],['oral','Communiquer oralement'],['multiple','Plusieurs compétences'],['unspecified','Compétence non précisée']];
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 function competency(work){
  const key=v=>{const s=normalize(v);return /^(lecture|lire)$/.test(s)?'lecture':/^(ecriture|ecrire)$/.test(s)?'ecriture':/^(oral|communiquer oralement|communication orale)$/.test(s)?'oral':null;};
  const explicit=key(work.competenceKind);if(explicit)return explicit;
  const keys=[...new Set((work.competencies||[]).map(key).filter(Boolean))];return keys.length>1?'multiple':keys[0]||'unspecified';
 }
 const label=key=>groups.find(g=>g[0]===key)?.[1]||groups[4][1];
 function orderWorks(works,grouped){return grouped?[...works].sort((a,b)=>groups.findIndex(g=>g[0]===competency(a))-groups.findIndex(g=>g[0]===competency(b))):[...works];}
 function followUp(input,options={}){
  const passing=number(options.passing)??60,threshold=Math.max(passing,number(options.threshold)??70),term=String(options.term||'all'),rows=[];
  const works=(input.assignments||[]).filter(w=>term==='all'||Number(w.term||1)===Number(term));
  for(const student of input.students||[]){
   const buckets=new Map();
   for(const work of works){
    const result=student.results?.[work.id];if(!result)continue;
    if(number(work.weight)===0)continue;
    const key=competency(work),stage=Number(work.term||1),id=stage+':'+key;
    if(!buckets.has(id))buckets.set(id,{competency:key,term:stage,values:[],missing:0});
    const bucket=buckets.get(id),grade=number(result.grade),max=number(work.maxScore);
    if(grade===null||grade<0||max===null||max<=0){bucket.missing++;continue;}
    bucket.values.push({percentage:grade/max*100,weight:number(work.weight)});
   }
   for(const b of buckets.values()){
    const graded=b.values.length,weighted=graded>0&&b.values.every(v=>v.weight!==null&&v.weight>0);
    const average=graded?(weighted?b.values.reduce((sum,v)=>sum+v.percentage*v.weight,0)/b.values.reduce((sum,v)=>sum+v.weight,0):b.values.reduce((sum,v)=>sum+v.percentage,0)/graded):null;
    const failures=b.values.filter(v=>v.percentage<passing).length;
    const level=average===null?'insufficient':average<passing?'failure':average<threshold||failures>=2?'watch':b.missing?'incomplete':null;
    if(level)rows.push({email:student.email,name:[student.lastName,student.firstName].filter(Boolean).join(', ')||student.name||student.email,competency:b.competency,label:label(b.competency),term:b.term,average,graded,missing:b.missing,failures,method:weighted?'weighted':'indicative',level,provisional:graded===1});
   }
  }
  const rank={failure:0,watch:1,insufficient:2,incomplete:3};
  return rows.sort((a,b)=>rank[a.level]-rank[b.level]||(a.average??Infinity)-(b.average??Infinity)||a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
 }
 root.CardinalOverviewCore={competency,label,orderWorks,followUp};
})(typeof window==='undefined'?globalThis:window);
