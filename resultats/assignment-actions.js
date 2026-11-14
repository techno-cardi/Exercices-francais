(function () {
  'use strict';
  let active = null;
  function reviewPreview(prepared) {
    if (active) return Promise.reject(new Error('Un aperçu est déjà ouvert.'));
    return new Promise((resolve, reject) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog';
      const head = document.createElement('div'); head.className = 'dialog-head';
      const title = document.createElement('h2'); title.textContent = 'Confirmer le nouveau maximum'; head.append(title);
      const body = document.createElement('div'); body.className = 'dialog-body';
      const preview = prepared.preview || {};
      const note = document.createElement('p');
      note.textContent = `Les notes sont remises à l’échelle sur ${preview.targetMaxScore} points. Les rétroactions et la visibilité sont conservées.`;
      body.append(note);
      const scroller = document.createElement('div'); scroller.style.cssText = 'max-height:45vh;overflow:auto';
      const table = document.createElement('table'); table.className = 'grade-table';
      const labels = {add:'Ajout',replace:'Remplacement',rescale:'Remise à l’échelle',unchanged:'Identique',blocked:'Conservée'};
      for (const row of preview.rows || []) {
        const tr = document.createElement('tr');
        for (const value of [row.name || row.email, labels[row.action] || row.action,
          `${row.beforeGrade ?? 'Non noté'}/${row.beforeMax ?? '?'} → ${row.afterGrade ?? 'Non noté'}/${preview.targetMaxScore}`, row.reason || '']) {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        }
        table.append(tr);
      }
      scroller.append(table); body.append(scroller);
      const error = document.createElement('p'); error.setAttribute('role','alert'); body.append(error);
      const actions = document.createElement('div'); actions.className = 'dialog-actions';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Annuler';
      const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'btn btn-primary'; confirm.textContent = 'Confirmer les changements';
      const finish = (result, failure) => { active = null; dialog.close(); dialog.remove(); failure ? reject(failure) : resolve(result); };
      const cancelled = () => finish(null, new Error('Modification du maximum annulée. Les paramètres saisis sont conservés.'));
      cancel.onclick = cancelled;
      dialog.addEventListener('cancel', event => { event.preventDefault(); if (!confirm.disabled) cancelled(); });
      confirm.onclick = async () => {
        confirm.disabled = true; cancel.disabled = true; error.textContent = '';
        try {
          const result = await api(TEACHER_ENDPOINT, {action:'formativeConfirm',token:state.teacherToken,previewId:prepared.previewId});
          finish(result);
        } catch (e) { error.textContent = e.message; confirm.disabled = false; cancel.disabled = false; }
      };
      actions.append(cancel, confirm); dialog.append(head,body,actions); document.body.append(dialog); active = dialog; dialog.showModal();
    });
  }
  // Le choix est éphémère et explicite à CHAQUE nouveau lot : aucune préférence
  // ne traverse les groupes, années ou reprises d'envoi déjà figées.
  function chooseMozaikWeightSource(context = {}) {
    if (active) return Promise.reject(new Error('Une fenêtre de confirmation est déjà ouverte.'));
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog formative-dialog';
      const head = document.createElement('div'); head.className = 'dialog-head';
      const title = document.createElement('h2'); title.textContent = 'Choisir la pondération de référence'; head.append(title);
      const body = document.createElement('div'); body.className = 'formative-dialog-body';
      const description = document.createElement('p');
      description.textContent = `Groupe ${context.groupCode || '—'} · ${context.title || 'Travail'} : quel système doit déterminer la pondération de ce nouvel envoi ?`;
      body.append(description);
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = 'Ce choix ne change pas la pondération de Gestion des notes. La valeur réelle de Mozaïk sera lue dans le bon groupe avant tout envoi. Tu vérifieras les deux valeurs et les notes dans l’aperçu suivant.';
      body.append(note);
      const settings=document.createElement('p');settings.className='hint';
      settings.textContent = 'Note maximale : Gestion '+(context.gestionMaxScore ?? '—')
        + ' points; Mozaïk '+(context.isNew ? 'nouvelle activité' : (context.mozaikMaxScore ?? 'à vérifier'))
        + '. Le maximum restera celui de Gestion : toute modification et toute remise à l’échelle hors lot seront montrées dans l’aperçu.';
      body.append(settings);
      const bulletin=document.createElement('p');bulletin.className='hint';
      const status=v=>v===true?'Oui':v===false?'Non':'à vérifier';
      bulletin.textContent='Porté au bulletin : Gestion '+status(context.gestionReportCard)
        +' · Mozaïk '+(context.isNew?'nouvelle activité':status(context.mozaikReportCard))
        +'. Ce statut et la pondération suivent ensemble la source choisie.';
      body.append(bulletin);
      const form = document.createElement('div');
      form.style.cssText = 'display:grid;gap:12px;margin:14px 0';
      const choices = [
        ['gestion', `Utiliser Gestion des notes (${context.gestionWeight == null ? 'non définie' : context.gestionWeight + ' %'})`, 'La pondération de Gestion sera appliquée à l’activité Mozaïk.'],
        ['mozaik', `Conserver Mozaïk (${context.isNew ? 'aucune activité' : context.mozaikWeight == null ? 'à vérifier' : context.mozaikWeight + ' %'})`, 'La valeur sera relue dans Mozaïk avant tout envoi; elle ne sera jamais recopiée dans Gestion. La portée au bulletin suit aussi la source choisie.']
      ];
      for (const [value, label, help] of choices) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #ccd5e2;border-radius:10px;cursor:pointer';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'cardinal-mozaik-weight-source'; input.value = value;
        if (value === 'mozaik' && context.isNew === true) {input.disabled=true;row.style.opacity='0.55';row.style.cursor='not-allowed';}
        input.style.marginTop='4px';
        const content=document.createElement('span');
        const strong=document.createElement('strong');strong.textContent=label;
        const small=document.createElement('small');small.style.cssText='display:block;margin-top:4px';small.textContent=help;
        content.append(strong,small);row.append(input,content);form.append(row);
      }
      body.append(form);
      const warning=document.createElement('p'); warning.className='hint';
      warning.textContent = 'Si l’activité est portée au bulletin, la pondération doit être numérique entre 0 et 100 %. Un travail non porté au bulletin conserve une pondération nulle.';
      body.append(warning);
      const actions=document.createElement('div');actions.className='dialog-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Annuler l’envoi';
      const next=document.createElement('button');next.type='button';next.className='btn btn-primary';next.textContent='Vérifier l’aperçu';next.disabled=true;
      const finish=result=>{ active=null;dialog.close();dialog.remove();resolve(result); };
      form.addEventListener('change',()=>{next.disabled=!form.querySelector('input:checked');});
      cancel.onclick=()=>finish(null);
      next.onclick=()=>finish(form.querySelector('input:checked')?.value || null);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
      actions.append(cancel,next);dialog.append(head,body,actions);document.body.append(dialog);active=dialog;dialog.showModal();
    });
  }
  // Independent choices. Nothing is saved locally or remotely by this dialog.
  function chooseMozaikParameterSources(context = {}) {
    if (active) return Promise.reject(new Error('Une fenêtre de confirmation est déjà ouverte.'));
    return new Promise(resolve => {
      const dialog=document.createElement('dialog');dialog.className='dialog formative-dialog';
      const head=document.createElement('div');head.className='dialog-head';
      const title=document.createElement('h2');title.textContent='Choisir les paramètres à harmoniser';head.append(title);
      const body=document.createElement('div');body.className='formative-dialog-body';
      const info=document.createElement('p');info.textContent=`Groupe ${context.groupCode||'—'} · ${context.title||'Travail'}`;body.append(info);
      const explanation=document.createElement('p');explanation.textContent='Choisis séparément la référence pour la pondération et le maximum. Après confirmation et vérification de l’envoi, Gestion des notes et Mozaïk utiliseront les mêmes valeurs.';body.append(explanation);
      const format=(v,suffix)=>v===null||v===undefined||v===''?'à vérifier':`${v}${suffix}`;
      const weight=(value,bulletin)=>bulletin===false?'Non porté au bulletin':format(value,' %');
      const groups=[
        {key:'weight',label:'Pondération et portée au bulletin',gestion:weight(context.gestionWeight,context.gestionReportCard),mozaik:weight(context.mozaikWeight,context.mozaikReportCard)},
        {key:'maximum',label:'Maximum de points',gestion:format(context.gestionMaxScore,' points'),mozaik:format(context.mozaikMaxScore,' points')}
      ];
      const form=document.createElement('div');form.style.cssText='display:grid;gap:16px';
      for(const group of groups){
        const fieldset=document.createElement('fieldset');fieldset.style.cssText='border:1px solid #ccd5e2;border-radius:10px;padding:14px';
        const legend=document.createElement('legend');legend.textContent=group.label;legend.style.fontWeight='700';fieldset.append(legend);
        for(const source of ['gestion','mozaik']){
          const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:12px;padding:10px;cursor:pointer';
          const input=document.createElement('input');input.type='radio';input.name=`cardinal-${group.key}-source`;input.value=source;
          if(source==='mozaik'&&context.isNew){input.disabled=true;row.style.opacity='.55';}
          const label=document.createElement('span');label.textContent=source==='gestion'?`Utiliser Gestion : ${group.gestion}`:`Utiliser Mozaïk : ${context.isNew?'nouveau travail, valeur indisponible':group.mozaik}`;
          row.append(input,label);fieldset.append(row);
        }
        form.append(fieldset);
      }
      body.append(form);
      const hint=document.createElement('p');hint.className='hint';hint.textContent='Si le maximum change, les notes de Gestion et les notes numériques conservées hors lot dans Mozaïk sont converties proportionnellement, avec arrondi au dixième. Une note absente reste absente. Les valeurs Mozaïk seront relues avant l’aperçu.';body.append(hint);
      const summary=document.createElement('p');summary.className='hint';summary.setAttribute('aria-live','polite');body.append(summary);
      const actions=document.createElement('div');actions.className='dialog-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Annuler';
      const next=document.createElement('button');next.type='button';next.className='btn btn-primary';next.textContent='Vérifier l’aperçu';next.disabled=true;
      const selected=()=>({weightSource:form.querySelector('input[name="cardinal-weight-source"]:checked')?.value,maximumSource:form.querySelector('input[name="cardinal-maximum-source"]:checked')?.value});
      form.addEventListener('change',()=>{const s=selected();next.disabled=!s.weightSource||!s.maximumSource;summary.textContent=next.disabled?'Choisis une référence pour chacun des deux paramètres.':`Après l’envoi : ${groups[0][s.weightSource]} · ${groups[1][s.maximumSource]} dans les deux systèmes.`;});
      const finish=value=>{active=null;dialog.close();dialog.remove();resolve(value);};
      cancel.onclick=()=>finish(null);next.onclick=()=>{const s=selected();if(s.weightSource&&s.maximumSource)finish({...s,alignmentVersion:1});};
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
      actions.append(cancel,next);dialog.append(head,body,actions);document.body.append(dialog);active=dialog;dialog.showModal();
    });
  }
  function reviewMozaik(preview, context = {}) {
    if (active) return Promise.reject(new Error('Un aperçu est déjà ouvert.'));
    if (!window.CardinalMozaikReview) return Promise.reject(new Error('Actualise Gestion des notes : le module de vérification de l’aperçu n’est pas chargé.'));
    const stale=context.reconcilingStale===true || preview.reconcilingStale===true;
    return new Promise(resolve => {
      const dialog=document.createElement('dialog');dialog.className='dialog formative-dialog mozaik-review-dialog';
      const heading=document.createElement('div');heading.className='dialog-head';
      const title=document.createElement('h2');title.textContent='Vérifier l’envoi dans Mozaïk';title.id='cardinal-review-title';dialog.setAttribute('aria-labelledby',title.id);heading.append(title);
      const body=document.createElement('div');body.className='formative-dialog-body';
      const note=document.createElement('p');note.textContent=`Groupe ${context.groupCode || ''} · ${context.title || ''}`;body.append(note);
      if(stale){const warning=document.createElement('p');warning.className='alert';warning.textContent='Gestion a changé depuis cet envoi. Cette reprise termine le lot précédent pour rétablir un état cohérent dans Mozaïk. Les changements plus récents resteront à envoyer ensuite.';body.append(warning);}
      const before=preview.activityBefore || {},after=preview.activityAfter || {};
      if(context.weightSource === 'mozaik' && !preview.gestionAfter) {
        const info=document.createElement('p');info.className='hint';
        info.textContent='Source de la pondération : Mozaïk. La pondération de Gestion n’est pas remplacée.';
        body.append(info);
      } else if(context.weightSource === 'gestion' && !preview.gestionAfter) {
        const info=document.createElement('p');info.className='hint';
        info.textContent='Source de la pondération : Gestion des notes. La valeur de Gestion sera appliquée à Mozaïk si nécessaire.';
        body.append(info);
      }
      if(preview.gestionAfter){
        const old=preview.gestionBefore||{},aligned=preview.gestionAfter;
        const label=(v,field)=>v===true?'Oui':v===false?'Non':v===null&&field==='Pondération'?'Sans pondération':v==null?'À vérifier':String(v)+(field==='Pondération'?' %':field==='Maximum'?' points':'');
        const heading=document.createElement('h3');heading.textContent=stale?'Paramètres de l’ancien lot à terminer dans Mozaïk':'Paramètres après confirmation : identiques dans les deux systèmes';body.append(heading);
        const table=document.createElement('table');table.className='grade-table';
        const header=document.createElement('tr');for(const text of ['Paramètre',stale?'Gestion dans l’ancien lot':'Gestion actuellement','Mozaïk actuellement',stale?'Cible de l’ancien lot':'Valeur retenue']){const th=document.createElement('th');th.textContent=text;header.append(th);}table.append(header);
        for(const values of [
          ['Pondération',old.weight,before.parametresEvaluation?.ponderation,aligned.weight],
          ['Maximum',old.maxScore,before.parametresEvaluation?.noteMaximale,aligned.maxScore],
          ['Porté au bulletin',old.reportCardEnabled,before.parametresEvaluation?.porteeAuBulletin,aligned.reportCardEnabled]
        ]){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=label(value,typeof value==='string'&&value===values[0]?'':values[0]);row.append(cell);}table.append(row);}
        const parameters=document.createElement('div');parameters.className='mozaik-review-parameters';parameters.append(table);body.append(parameters);
        const warning=document.createElement('p');warning.className='hint';warning.textContent=stale?'Le contenu actuel de Gestion sera conservé. Seule la cible figée de cet ancien lot sera terminée dans Mozaïk; les changements récents resteront à synchroniser.':'Les notes ci-dessous proviennent de Gestion. Leur conversion sera aussi enregistrée dans Gestion une seule fois, après vérification de Mozaïk. Un échec ou une modification concurrente ne sera pas annoncé comme un alignement réussi.';body.append(warning);
      }
      const destination=document.createElement('p');
      destination.textContent=preview.activityBefore
        ? `Destination Mozaïk : ${before.titre || 'Travail sans titre'} · Période ${before.periode ?? 'à compléter'}`
        : `Destination Mozaïk : nouveau travail « ${after.titre || context.title || 'sans titre'} »`;
      body.append(destination);
      const fields=[['Titre',before.titre,after.titre],['Maximum',before.parametresEvaluation?.noteMaximale,after.parametresEvaluation?.noteMaximale],['Pondération',before.parametresEvaluation?.ponderation,after.parametresEvaluation?.ponderation],['Portée au bulletin',before.parametresEvaluation?.porteeAuBulletin,after.parametresEvaluation?.porteeAuBulletin],['Compétence',before.parametresEvaluation?.competence,after.parametresEvaluation?.competence],['Étape',before.codeEtape,after.codeEtape],['Période',before.periode,after.periode],['Devoir',before.faitALaMaison,after.faitALaMaison],['Évaluation notée',before.parametresEvaluation?.evaluee,after.parametresEvaluation?.evaluee],['Résultats visibles dans Mozaïk',before.parametresEvaluation?.resultatsDisponibles,after.parametresEvaluation?.resultatsDisponibles],['Date',before.dateActivite,after.dateActivite],['Présence dans l’horaire',before.afficheeDansHoraire,after.afficheeDansHoraire]];
      const show=value=>value===true?'Oui':value===false?'Non':value??'À compléter';
      for(const [label,oldValue,newValue]of fields){if(oldValue===newValue)continue;const p=document.createElement('p');p.textContent=`${label} : ${show(oldValue)} → ${show(newValue)}`;body.append(p);}
      const reviewHost=document.createElement('section');body.append(reviewHost);
      const actions=document.createElement('div');actions.className='dialog-actions';
      let settled=false;
      const finish=ok=>{if(settled)return;settled=true;active=null;dialog.close();dialog.remove();resolve(ok);};
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Annuler';cancel.onclick=()=>finish(false);
      const confirm=document.createElement('button');confirm.type='button';confirm.className='btn btn-primary';confirm.textContent=stale?'Terminer l’ancien envoi':'Confirmer l’envoi';confirm.disabled=true;
      const review=window.CardinalMozaikReview.mount(reviewHost,preview,context,ready=>{confirm.disabled=!ready;});
      confirm.onclick=()=>{if(review.canConfirm())finish(true);};
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      dialog.addEventListener('close',()=>finish(false));
      actions.append(cancel,confirm);dialog.append(heading,body,actions);document.body.append(dialog);active=dialog;dialog.showModal();
    });
  }
  window.CardinalAssignmentActions = {reviewPreview,reviewMozaik,chooseMozaikWeightSource,chooseMozaikParameterSources};
})();
