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
      const form = document.createElement('div');
      form.style.cssText = 'display:grid;gap:12px;margin:14px 0';
      const choices = [
        ['gestion', `Utiliser Gestion des notes (${context.gestionWeight == null ? 'non définie' : context.gestionWeight + ' %'})`, 'La pondération de Gestion sera appliquée à l’activité Mozaïk.'],
        ['mozaik', 'Conserver la pondération actuelle dans Mozaïk', 'La pondération sera lue directement sur l’activité Mozaïk sélectionnée, sans la recopier dans Gestion. Si la valeur est illisible ou l’activité absente, l’envoi sera bloqué.']
      ];
      for (const [value, label, help] of choices) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #ccd5e2;border-radius:10px;cursor:pointer';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'cardinal-mozaik-weight-source'; input.value = value;
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
  function reviewMozaik(preview, context = {}) {
    if (active) return Promise.reject(new Error('Un aperçu est déjà ouvert.'));
    return new Promise(resolve => {
      const dialog=document.createElement('dialog');dialog.className='dialog formative-dialog';
      const heading=document.createElement('div');heading.className='dialog-head';
      const title=document.createElement('h2');title.textContent='Vérifier l’envoi dans Mozaïk';heading.append(title);
      const body=document.createElement('div');body.className='formative-dialog-body';
      const note=document.createElement('p');note.textContent=`Groupe ${context.groupCode || ''} · ${context.title || ''}`;body.append(note);
      if(context.reconcilingStale){const warning=document.createElement('p');warning.className='alert';warning.textContent='Gestion a changé depuis cet envoi. Cette reprise termine le lot précédent pour rétablir un état cohérent dans Mozaïk. Les changements plus récents resteront à envoyer ensuite.';body.append(warning);}
      const before=preview.activityBefore || {},after=preview.activityAfter || {};
      if(context.weightSource === 'mozaik') {
        const info=document.createElement('p');info.className='hint';
        info.textContent='Source de la pondération : Mozaïk. La pondération de Gestion n’est pas remplacée.';
        body.append(info);
      } else if(context.weightSource === 'gestion') {
        const info=document.createElement('p');info.className='hint';
        info.textContent='Source de la pondération : Gestion des notes. La valeur de Gestion sera appliquée à Mozaïk si nécessaire.';
        body.append(info);
      }
      const destination=document.createElement('p');
      destination.textContent=preview.activityBefore
        ? `Destination Mozaïk : ${before.titre || 'Travail sans titre'} · Période ${before.periode ?? 'à compléter'}`
        : `Destination Mozaïk : nouveau travail « ${after.titre || context.title || 'sans titre'} »`;
      body.append(destination);
      const fields=[['Titre',before.titre,after.titre],['Maximum',before.parametresEvaluation?.noteMaximale,after.parametresEvaluation?.noteMaximale],['Pondération',before.parametresEvaluation?.ponderation,after.parametresEvaluation?.ponderation],['Portée au bulletin',before.parametresEvaluation?.porteeAuBulletin,after.parametresEvaluation?.porteeAuBulletin],['Compétence',before.parametresEvaluation?.competence,after.parametresEvaluation?.competence],['Étape',before.codeEtape,after.codeEtape],['Période',before.periode,after.periode],['Devoir',before.faitALaMaison,after.faitALaMaison],['Évaluation notée',before.parametresEvaluation?.evaluee,after.parametresEvaluation?.evaluee],['Résultats visibles dans Mozaïk',before.parametresEvaluation?.resultatsDisponibles,after.parametresEvaluation?.resultatsDisponibles],['Date',before.dateActivite,after.dateActivite],['Présence dans l’horaire',before.afficheeDansHoraire,after.afficheeDansHoraire]];
      const show=value=>value===true?'Oui':value===false?'Non':value??'À compléter';
      for(const [label,oldValue,newValue]of fields){if(oldValue===newValue)continue;const p=document.createElement('p');p.textContent=`${label} : ${show(oldValue)} → ${show(newValue)}`;body.append(p);}
      const hint=document.createElement('p');hint.textContent='Les lignes conservées hors lot sont incluses ci-dessous. Si le maximum change, leurs notes sont recalculées proportionnellement et arrondies au dixième; les valeurs avant et après sont affichées.';body.append(hint);
      const scroll=document.createElement('div');scroll.style.cssText='max-height:42vh;overflow:auto';
      const table=document.createElement('table');table.className='grade-table';
      for(const row of preview.rows||[]){const tr=document.createElement('tr');for(const value of [row.name || `Élève ${row.fiche}`,row.source==='gestion'?'Note de Gestion':'Conservée hors lot',`${show(row.beforeGrade)}/${show(row.beforeMax)} → ${show(row.afterGrade)}/${show(row.afterMax)}`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}table.append(tr);}
      scroll.append(table);body.append(scroll);
      const actions=document.createElement('div');actions.className='dialog-actions';
      const finish=ok=>{active=null;dialog.close();dialog.remove();resolve(ok);};
      const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Annuler';cancel.onclick=()=>finish(false);
      const confirm=document.createElement('button');confirm.className='btn btn-primary';confirm.textContent=context.reconcilingStale?'Terminer l’ancien envoi':'Confirmer l’envoi';confirm.onclick=()=>finish(true);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      actions.append(cancel,confirm);dialog.append(heading,body,actions);document.body.append(dialog);active=dialog;dialog.showModal();
    });
  }
  window.CardinalAssignmentActions = {reviewPreview,reviewMozaik,chooseMozaikWeightSource};
})();
