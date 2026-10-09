/* Projet Cardinal. Complément chargé APRÈS dictee-eleonore.html.
   Aucune identité, note, copie, mot secret ni solution personnelle en code public. */
(()=>{
'use strict';
const base='https://ojyswaxuqwnqilrvtjll.supabase.co';
const key='sb_publishable_mI94i3exzVPlHveGFX1WOw_1Ucab3_f';
const preview=window.eleonoreTeacherPreview===true;
const $=s=>document.querySelector(s);
let session;try{session=JSON.parse(sessionStorage.getItem(preview?'francais.prof.preview':'francais.portail.session')||'null');}catch{}
if(!session||(!preview&&Number(session.level)!==3))return;
const assignment=preview?String(session.workSlug||'dictee-eleonore-2026-10-08'):'dictee-eleonore-2026-10-08';
const token=String(preview?session.token:session.schoolToken||'');
const status=$('#availability');
const wrap=document.createElement('section');wrap.className='card';wrap.id='monParcours';
const title=document.createElement('h2');title.textContent='Mon parcours de correction';wrap.append(title);
const msg=document.createElement('p');msg.className='small';msg.setAttribute('role','status');wrap.append(msg);
const steps=document.createElement('div');wrap.append(steps);
const ref=$('#copyTitle')?.closest('section');if(ref)ref.before(wrap);
let info=null;
function el(tag,content,cls){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;}
function line(node,tag,content,cls){const n=el(tag,content,cls);node.append(n);return n;}
function btn(node,content,action){const b=line(node,'button',content,'btn');b.type='button';b.addEventListener('click',action);return b;}
async function action(name,args={}){
 if(preview&&name!=='load')throw new Error('Aperçu en lecture seule.');
 const actualAction=preview?'teacherPreview':name;
 const extras=preview?{studentEmail:session.studentEmail}:{};
 const r=await fetch(base+'/functions/v1/fr-dictee-feedback',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','apikey':key},body:JSON.stringify({action:actualAction,token,workSlug:assignment,...extras,...args})});
 let result=null;try{result=await r.json();}catch{}
 if(!r.ok||result?.ok!==true)throw new Error(result?.message||'Le suivi ne répond pas. Réessaie.');
 return result;
}
function strategy(key, categoryOverride=''){
 const category=categoryOverride||(typeof RULES==='object' ? RULES[key]?.category : '')||(key.startsWith('phrase-')?'Structure de phrase':'');
 if(/écoute|fidélité|omission|mots oubliés/i.test(category))return ['Écouter toute la phrase et demander qu’on répète si un mot n’est pas clair.','Remplacer les mots entendus par des synonymes sans vérifier.','Chercher dans Usito les mots qu’on n’a pas entendus.'];
 if(/Structure de phrase/.test(category))return ['Écouter la phrase au complet et demander qu’on répète si un mot manque ou semble incertain.','Remplacer les mots entendus par d’autres qui veulent dire la même chose.','Chercher dans Usito les mots qui ont été oubliés.'];
 if(/ponctuation/i.test(category))return ['Relire la phrase et encadrer les groupes détachés avec les virgules nécessaires.','Mettre une virgule après chaque mot difficile.','Retirer toutes les virgules pour lire plus vite.'];
 if(/orthographe|lexique|vocabulaire/i.test(category))return ['Chercher le mot dans Usito et vérifier ses lettres, ses accents et sa graphie exacte.','Écrire le mot seulement comme il se prononce.','Ajouter une lettre muette sans vérifier.'];
 if(/homophone/i.test(category))return ['Vérifier le sens de la phrase et essayer un remplacement.','Choisir la forme qui ressemble au mot précédent.','Ajouter un accent à chaque mot prononcé de la même façon.'];
 if(/participe passé avec avoir/i.test(category))return ['Trouver le CD, sa position, puis son genre et son nombre.','Accorder systématiquement le participe passé avec le sujet.','Regarder uniquement la terminaison de l’auxiliaire.'];
 if(/accord|adjectif|participe/i.test(category))return ['Relier le mot au nom ou au sujet qu’il décrit, puis vérifier le genre et le nombre.','Ajouter toujours un -s à la fin du mot.','Se fier uniquement à la façon dont le mot se prononce.'];
 if(/verbe|imparfait|temps|subjonctif/i.test(category))return ['Repérer le sujet, le temps du récit et vérifier la terminaison.','Accorder le verbe avec le dernier nom écrit.','Remplacer toutes les terminaisons par -é.'];
 return ['Vérifier d’abord le sens et la structure de la phrase, puis confirmer les mots difficiles dans Usito.','Remplacer le mot au hasard par un autre mot qui sonne pareil.','Ajouter une lettre muette pour être certain.'];
}
function mixed(key,error){
 // Positions stables, sans données privées persistées : hash de l'identifiant de session et clé de règle.
 const s=String(preview?session.studentEmail:session.schoolEmail||'')+'|'+key;let h=0;
 for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;
 const correct=h%3;
 const specific=error?.quiz;
 const choices=(specific&&typeof specific.prompt==='string'&&Array.isArray(specific.choices)&&specific.choices.length===3&&specific.choices.every(x=>typeof x==='string'&&x.trim().length>5)&&new Set(specific.choices).size===3)?specific.choices:strategy(key,error?.category||'');
 const ordered=[null,null,null];ordered[correct]=choices[0];ordered[(correct+1)%3]=choices[1];ordered[(correct+2)%3]=choices[2];
 return {correct,ordered};
}
function render(){
 steps.replaceChildren();
 if(!info)return;
 if(preview)line(steps,'p','APERÇU ENSEIGNANT : lecture seule. Aucune progression ne sera modifiée.','notice');
  if(info.unreleased&&!preview){
    line(steps,'h3','Révision des explications en cours');
    line(steps,'p','Les explications interactives et la première page des bilans sont temporairement en révision. Ta dictée manuscrite corrigée (page 2) et ta feuille de vérification (page 3) restent la référence.');
    if(/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view(?:[?#].*)?$/.test(info.copyUrl||'')){
      const link=line(steps,'a','Voir ma copie manuscrite et mes corrections ↗','btn');
      link.href=info.copyUrl;link.rel='noopener noreferrer';link.target='_blank';link.style.textDecoration='none';
    }
    if(info.progress?.completedAt)line(steps,'p','Ton premier travail demeure enregistré.','small');
    return;
  }
 const prog=info.progress||{};
 const top=line(steps,'p',`Groupe ${info.group} · Note : ${info.grade===null?'à confirmer':Number(info.grade).toLocaleString('fr-CA')+' / '+info.maxScore}`,'small');
 top.style.fontWeight='bold';
 if(prog.completedAt){line(steps,'h3','Première vérification enregistrée');line(steps,'p','Tu peux revoir les explications, sans perdre le travail déjà effectué.');}
 const first=line(steps,'div',undefined,'exercise');
 line(first,'h3','1. Ouvrir ma copie');
 line(first,'p','Lis ton commentaire à la page 1, puis regarde la copie corrigée à la page 2 et ta feuille de vérification à la page 3.');
 if(/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view(?:[?#].*)?$/.test(info.copyUrl||'')){const link=line(first,'a','Ouvrir mon PDF personnel ↗','btn');link.href=info.copyUrl;link.target='_blank';link.rel='noopener noreferrer';link.style.textDecoration='none';link.addEventListener('click',()=>{action('copyOpened').then(()=>reload()).catch(e=>msg.textContent=e.message);});}
 line(first,'p',prog.copyOpened?'Lien vers la copie activé : oui':'Lien vers la copie à activer','small');
 const second=line(steps,'div',undefined,'exercise');line(second,'h3','2. Comprendre mes erreurs');
 if(!info.ready){line(second,'p','Les erreurs individuelles sont en cours de vérification par ton enseignant. Les explications générales restent accessibles plus haut.');}
 else if(!info.errors?.length){line(second,'p','Bravo! Aucune erreur personnelle à corriger dans cette dictée.');}
 else{
   const understood=new Set(prog.understoodKeys||[]);
   line(second,'p',`${understood.size} / ${info.errors.length} difficultés comprises.`,'small');
   info.errors.forEach((error,i)=>{
     const card=line(second,'div',undefined,'exercise');
     line(card,'h3',(i+1)+'. '+(error.title||error.correct||'Point à revoir'));
     if(error.written)line(card,'p','Dans ta copie : « '+error.written+' ».');
     if(error.correct)line(card,'p','On écrit : « '+error.correct+' ».');
     if(error.comment)line(card,'p',error.comment);
     const rule=(typeof RULES==='object' ? RULES[error.key]?.rule : '')||'';
     if(rule)line(card,'p',rule);
     if(understood.has(error.key)){line(card,'p','Compris et enregistré.','small');return;}
     const passed=new Set(prog.strategyKeys||[]);
     line(card,'p',error.quiz?.prompt||'Quelle stratégie utiliserais-tu pour éviter cette erreur?');
     const {correct,ordered}=mixed(error.key,error);
     const feedback=line(card,'p','', 'feedback');
     const confirm=()=>{
       if(card.querySelector('[data-understood]'))return;
       const button=btn(card,'J’ai compris cette erreur',async()=>{
         button.disabled=true;
         try{await action('understood',{key:error.key,understood:true});await reload();}
         catch(e){button.disabled=false;msg.textContent=e.message;}
       });
       button.dataset.understood='true';
     };
     if(passed.has(error.key)) {line(card,'p','Bonne stratégie déjà trouvée. Confirme ce que tu as compris.');confirm();}
     else ordered.forEach((text,index)=>btn(card,`${index+1}. ${text}`,async()=>{
       try{
         const result=await action('strategy',{key:error.key,choice:index});
         if(!result.correct){feedback.textContent='Ce n’est pas la meilleure méthode. Essaie une autre stratégie.';return;}
         feedback.textContent='Bonne stratégie! Tu peux maintenant confirmer ta compréhension.';
         card.querySelectorAll('button').forEach(b=>{if(b!==card.querySelector('[data-understood]'))b.disabled=true;});
         confirm();
       }catch(e){feedback.textContent=e.message;}
     }));
   });
 }
 const third=line(steps,'div',undefined,'exercise');line(third,'h3','3. Consulter mon bilan');
 line(third,'p','Relis la première page de ton PDF et la stratégie complète de la boîte à outils, p. 1 : texte et ponctuation, points au-dessus des noms avec genre/nombre et flèches d’accord, verbes surlignés reliés au sujet, pronom de remplacement, temps, participes passés, homophones et mots difficiles dans Usito.');
 btn(third,prog.bilanSeen?'Bilan consulté':'J’ai lu mon bilan',async()=>{try{await action('bilanSeen');await reload();}catch(e){msg.textContent=e.message;}}).disabled=!!prog.bilanSeen;
 const done=(info.errors||[]).every(e=>(prog.understoodKeys||[]).includes(e.key));
 const fourth=line(steps,'div',undefined,'exercise');line(fourth,'h3','4. Valider mon travail');
 if(!info.ready)line(fourth,'p','Validation disponible une fois les erreurs personnelles vérifiées.');
 else if(!prog.copyOpened||!prog.bilanSeen||!done)line(fourth,'p','Ouvre ta copie, vérifie tes erreurs et consulte ton bilan avant de valider.');
 else{
   const f=line(fourth,'form');
   const label=line(f,'label','Mot secret imprimé à la page 1');label.htmlFor='validationMot';
   const input=line(f,'input');input.id='validationMot';input.required=true;input.maxLength=9;input.autocomplete='off';input.placeholder='XXXX-XXXX';input.style.padding='12px';
   const send=line(f,'button','Terminer mon travail','btn');send.type='submit';
   f.addEventListener('submit',async e=>{e.preventDefault();send.disabled=true;try{await action('finish',{secret:input.value});input.value='';await reload();}catch(err){msg.textContent=err.message;send.disabled=false;}});
 }
}
async function reload(){try{info=await action('load');
 if(info.ready && typeof activatePersonal==='function'){
   window.eleonoreExternalTracking=true;
   activatePersonal({ok:true,first:info.first,note:info.grade,copyUrl:info.copyUrl,errorKeys:(info.errors||[]).map(e=>e.key),errors:info.errors,progress:{understoodKeys:info.progress?.understoodKeys||[]}});
   // La validation des stratégies est exclusivement gérée par le parcours ci-dessus.
 }
 msg.textContent=preview?'Aperçu enseignant en lecture seule.':info.unreleased?'Le travail individuel n’est pas encore publié.':info.ready?'Ton suivi est enregistré automatiquement.':'Les erreurs personnalisées restent en vérification.';render();if(preview)steps.querySelectorAll('button, input').forEach(element=>element.disabled=true);}catch(err){msg.textContent=err.message;}}
// Le portail ne transfère jamais une fiche dans le code public. Le jeton est éphémère dans sessionStorage.
if(!preview)$('#copyLink')?.addEventListener('click',()=>{action('copyOpened').then(reload).catch(err=>msg.textContent=err.message);});
if(!token)msg.textContent='Accès personnel indisponible : reconnecte-toi depuis le portail avec ton courriel scolaire et ta fiche.';
else reload();
})();