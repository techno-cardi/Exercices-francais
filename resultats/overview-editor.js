(function(root){
 'use strict';
 function create({save,parse,onSaved,onState}){
  const tracked=new Map(),pending=new Map();let tail=Promise.resolve();
  function track(input,cell){tracked.set(input,{cell,original:input.value,error:null});}
  function hasUnsaved(){return pending.size>0||[...tracked].some(([input,item])=>item.error||input.value.trim()!==item.original.trim());}
  function commit(input){
   if(pending.has(input))return pending.get(input);
   const item=tracked.get(input);if(!item)return Promise.resolve(true);
   if(item.cell.readOnly)return Promise.resolve(false);
   if(input.value.trim()===item.original.trim()&&!item.error)return Promise.resolve(true);
   const typed=input.value;let parsed;
   try{parsed=parse(typed,item.cell.assignment.maxScore);}catch(error){item.error=error;input.classList.add('error');onState(error.message,'error');return Promise.resolve(false);}
   const task=tail.then(async()=>{
    try{
     await save(item.cell,parsed);onSaved(item.cell,parsed.grade);
     input.value=parsed.text;item.original=parsed.text;item.error=null;input.classList.add('saved');onState('Note enregistrée.','saved');return true;
    }catch(error){item.error=error;input.value=typed;input.classList.add('error');onState(error.message+' Votre saisie est conservée.','error');return false;}
    finally{input.disabled=false;input.classList.remove('saving');pending.delete(input);}
   });
   pending.set(input,task);tail=task.then(()=>{});
   // Register before disabling: disabling a focused field can synchronously blur.
   input.disabled=true;input.classList.remove('error','saved');input.classList.add('saving');onState('Enregistrement…','saving');return task;
  }
  async function flush(){
   for(const [input,item] of tracked)if(!pending.has(input)&&!item.error&&input.value.trim()!==item.original.trim())commit(input);
   await tail;return !hasUnsaved();
  }
  function cancel(input){const item=tracked.get(input);if(!item||pending.has(input)||item.error)return false;input.value=item.original;input.classList.remove('error');return true;}
  function clear(){if(pending.size)return false;tracked.clear();return true;}
  return{track,commit,flush,hasUnsaved,cancel,clear,settle:()=>tail};
 }
 root.CardinalOverviewEditor={create};
})(typeof window==='undefined'?globalThis:window);
