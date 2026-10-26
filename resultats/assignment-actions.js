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
      const fields=[['Titre',before.titre,after.titre],['Maximum',before.parametresEvaluation?.noteMaximale,after.parametresEvaluation?.noteMaximale],['Pondération',before.parametresEvaluation?.ponderation,after.parametresEvaluation?.ponderation],['Portée au bulletin',before.parametresEvaluation?.porteeAuBulletin,after.parametresEvaluation?.porteeAuBulletin],['Compétence',before.parametresEvaluation?.competence,after.parametresEvaluation?.competence],['Étape',before.codeEtape,after.codeEtape],['Période',before.periode,after.periode],['Devoir',before.faitALaMaison,after.faitALaMaison],['Évaluation notée',before.parametresEvaluation?.evaluee,after.parametresEvaluation?.evaluee],['Résultats visibles dans Mozaïk',before.parametresEvaluation?.resultatsDisponibles,after.parametresEvaluation?.resultatsDisponibles],['Date',before.dateActivite,after.dateActivite],['Présence dans l’horaire',before.afficheeDansHoraire,after.afficheeDansHoraire]];
      const show=value=>value===true?'Oui':value===false?'Non':value??'À compléter';
      for(const [label,oldValue,newValue]of fields){if(oldValue===newValue)continue;const p=document.createElement('p');p.textContent=`${label} : ${show(oldValue)} → ${show(newValue)}`;body.append(p);}
      const hint=document.createElement('p');hint.textContent='Les lignes conservées hors lot sont incluses ci-dessous. Un changement de maximum conserve leur proportion.';body.append(hint);
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
  window.CardinalAssignmentActions = {reviewPreview,reviewMozaik};
})();
