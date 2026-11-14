/* Presentation-only review. Never modifies a payload, sends a request or stores pupil data. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardinalMozaikReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const labels = {added:'Ajout', modified:'Résultat modifié', scaled:'Échelle seulement', unchanged:'Identique', invalid:'À vérifier'};
  const empty = value => value === null || value === undefined || typeof value === 'string' && value.trim() === '';
  function grade(value) {
    if (empty(value)) return {kind:'empty', value:null};
    if (typeof value === 'number') return Number.isFinite(value) ? {kind:'number', value} : {kind:'invalid'};
    if (typeof value !== 'string') return {kind:'invalid'};
    const s = value.trim();
    if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s)) {
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) ? {kind:'number',value:n} : {kind:'invalid'};
    }
    if (/^(?:NaN|[+-]?Infinity)$/i.test(s)) return {kind:'invalid'};
    return {kind:'code',value:s};
  }
  const sameNumber = (a,b) => Math.abs(a-b) < 1e-9;
  function validMax(value) { const n=grade(value);return n.kind==='number' && n.value>0 ? n.value : null; }
  function compare(oldValue, oldMax, newValue, newMax) {
    const a=grade(oldValue),b=grade(newValue);
    if (a.kind==='empty') return b.kind==='empty'?'unchanged':'added';
    if (a.kind==='number' && b.kind==='number') {
      const m=validMax(oldMax),n=validMax(newMax);
      if(m!==null && n!==null) {
        if(sameNumber(m,n) && sameNumber(a.value,b.value))return 'unchanged';
        // Presentation only: match the engine's single one-decimal scale conversion.
        if(!sameNumber(m,n) && sameNumber(Math.round(a.value/m*n*10)/10,b.value))return 'scaled';
      }
      return 'modified';
    }
    return a.kind===b.kind && a.value===b.value?'unchanged':'modified';
  }
  function analyze(preview, context={}) {
    const p=preview && typeof preview==='object'?preview:{};
    const stale=context.reconcilingStale===true || p.reconcilingStale===true;
    const report={alignsGestion:!!p.gestionAfter&&!stale,stale,rows:[],issues:[],blocked:false,
      counts:{total:0,added:0,modified:0,scaled:0,unchanged:0,invalid:0,outside:0},
      risks:{zero:[],codes:[],publication:p.activityAfter?.parametresEvaluation?.resultatsDisponibles===true && p.activityBefore?.parametresEvaluation?.resultatsDisponibles!==true}};
    if(!Array.isArray(p.rows)||!p.rows.length)report.issues.push('L’aperçu des notes est absent ou vide. Prépare un nouvel aperçu avant de confirmer.');
    const seen=new Set();
    for(const [index,r] of (Array.isArray(p.rows)?p.rows:[]).entries()){
      const row=r && typeof r==='object'&&!Array.isArray(r)?r:{};
      const item={index,name:typeof row.name==='string'&&row.name.trim()?row.name:`Élève ${index+1}`,source:row.source,
        beforeGrade:row.beforeGrade,beforeMax:row.beforeMax,afterGrade:row.afterGrade,afterMax:row.afterMax,
        gestionBeforeGrade:row.gestionBeforeGrade,gestionBeforeMax:row.gestionBeforeMax,
        kind:'unchanged',nativeChange:null,gestionChange:null,attention:false};
      const a=grade(row.beforeGrade),b=grade(row.afterGrade),problems=[];
      if(!['gestion','preserved'].includes(row.source))problems.push('Source de note inconnue.');
      if(a.kind==='invalid'||b.kind==='invalid')problems.push('Une note est illisible.');
      if(b.kind==='number'&&(validMax(row.afterMax)===null||b.value<0||b.value>validMax(row.afterMax)+1e-9))problems.push('Note finale ou maximum invalide.');
      if(a.kind==='number'&&(validMax(row.beforeMax)===null||a.value<0))problems.push('L’échelle actuelle de Mozaïk est illisible.');
      if(a.kind!=='empty'&&b.kind==='empty')problems.push('Une note existante disparaîtrait.');
      if(row.source==='gestion'&&b.kind==='code')problems.push('Une note de Gestion ne peut pas devenir un code spécial.');
      if(!empty(row.fiche)){
        const id=String(row.fiche);
        if(seen.has(id))problems.push('Un élève apparaît plusieurs fois dans l’aperçu.');seen.add(id);
      }
      item.nativeChange=compare(row.beforeGrade,row.beforeMax,row.afterGrade,row.afterMax);
      if(report.alignsGestion && row.source==='gestion'){
        const old=grade(row.gestionBeforeGrade);
        if(old.kind!=='number'||validMax(row.gestionBeforeMax)===null||old.value<0)problems.push('La note ou le maximum actuel de Gestion manque dans l’aperçu.');
        item.gestionChange=compare(row.gestionBeforeGrade,row.gestionBeforeMax,row.afterGrade,row.afterMax);
        if(old.kind==='number'&&old.value>0&&b.kind==='number'&&b.value===0)item.zeroReplacement=true;
      }
      if(a.kind==='number'&&a.value>0&&b.kind==='number'&&b.value===0)item.zeroReplacement=true;
      if(a.kind==='code'&&(b.kind!=='code'||a.value!==b.value))item.codeReplacement=true;
      const changes=[item.nativeChange,item.gestionChange];
      item.kind=changes.includes('modified')?'modified':changes.includes('added')?'added':changes.includes('scaled')?'scaled':'unchanged';
      if(problems.length){item.kind='invalid';item.problems=problems;report.issues.push(...problems.map(message=>`${item.name} : ${message}`));}
      item.attention=!!item.zeroReplacement||!!item.codeReplacement||!!problems.length;
      if(item.zeroReplacement)report.risks.zero.push(item);
      if(item.codeReplacement)report.risks.codes.push(item);
      report.counts[item.kind]++;
      if(row.source==='preserved')report.counts.outside++;
      report.rows.push(item);
    }
    report.counts.total=report.rows.length;report.blocked=report.issues.length>0;
    return report;
  }
  const counted=(n,one,many)=>`${n} ${n===1?one:many}`;
  const numberFormat=new Intl.NumberFormat('fr-CA',{maximumFractionDigits:6});
  function formatGrade(value,maximum){
    const g=grade(value);
    if(g.kind==='empty')return 'Non noté';
    if(g.kind==='invalid')return 'Illisible';
    if(g.kind==='code')return `${g.value} (code)`;
    return `${numberFormat.format(g.value)} / ${validMax(maximum)===null?'?':numberFormat.format(validMax(maximum))}`;
  }
  const searchable=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-CA');
  function selectRows(report,filter='all',query=''){
    const term=searchable(query).trim();
    return report.rows.filter(row=>(filter==='changes'?row.kind!=='unchanged':filter==='attention'?row.attention:true)&&(!term||searchable(row.name).includes(term)));
  }
  function mount(host, preview, context={}, onReadiness=()=>{}) {
    const document=host.ownerDocument,report=analyze(preview,context),acknowledgments=[];
    const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
    host.classList.add('mozaik-review');
    const summary=element('div','mozaik-review-summary');summary.setAttribute('aria-label','Bilan de l’aperçu');
    for(const [key,label] of [['added',['ajout','ajouts']],['modified',['résultat modifié','résultats modifiés']],['scaled',['conversion d’échelle','conversions d’échelle']],['unchanged',['identique','identiques']]]){
      summary.append(element('span',`mozaik-review-count mozaik-review-${key}`,counted(report.counts[key],...label)));
    }
    host.append(summary);
    host.append(element('p','hint',`${counted(report.counts.total,'ligne à vérifier','lignes à vérifier')}, dont ${report.counts.outside} hors lot de Gestion. « Échelle seulement » indique une conversion proportionnelle, arrondie au dixième.`));
    if(report.blocked){
      const error=element('div','mozaik-review-warning');error.setAttribute('role','alert');
      error.append(element('strong',null,'Confirmation bloquée : l’aperçu doit être vérifié.'));
      for(const issue of report.issues)error.append(element('p',null,issue));host.append(error);
    }
    function acknowledge(kind,text,details){
      const warning=element('div','mozaik-review-warning');warning.dataset.risk=kind;
      warning.append(element('p',null,text));
      if(details?.length)warning.append(element('p','mozaik-review-risk-names',details.map(r=>r.name).join(', ')));
      const label=element('label','mozaik-review-ack');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.ack=kind;
      label.append(checkbox,element('span',null,'J’ai vérifié et je confirme ce changement.'));
      warning.append(label);host.append(warning);acknowledgments.push(checkbox);
      checkbox.addEventListener('change',()=>onReadiness(canConfirm()));
    }
    if(report.risks.zero.length)acknowledge('zero',`${counted(report.risks.zero.length,'note positive serait remplacée','notes positives seraient remplacées')} par zéro. Vérifie ces lignes.`,report.risks.zero);
    if(report.risks.codes.length)acknowledge('codes',`${counted(report.risks.codes.length,'code spécial serait remplacé','codes spéciaux seraient remplacés')} (absence, exemption ou autre code).`,report.risks.codes);
    if(report.risks.publication)acknowledge('publication','Les résultats de cette activité deviendraient visibles dans Mozaïk. Ce réglage concerne toute l’activité, pas seulement les lignes filtrées.');
    const toolbar=element('div','mozaik-review-tools');
    const searchLabel=element('label',null,'Rechercher un élève');const search=document.createElement('input');search.type='search';search.className='input';search.placeholder='Nom de l’élève';searchLabel.append(search);
    const filterLabel=element('label',null,'Afficher');const filter=document.createElement('select');filter.className='select';
    for(const [value,text] of [['all','Toutes les lignes'],['changes','Seulement les changements'],['attention','Points d’attention']]){const option=element('option',null,text);option.value=value;filter.append(option);}filterLabel.append(filter);
    toolbar.append(searchLabel,filterLabel);host.append(toolbar);
    host.append(element('p','hint','La recherche et le filtre changent seulement l’affichage. Toutes les lignes du lot restent incluses dans l’envoi.'));
    const visible=element('p','hint');visible.setAttribute('role','status');visible.setAttribute('aria-live','polite');host.append(visible);
    const scroll=element('div','mozaik-review-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Comparaison des notes avant envoi');
    const table=element('table','grade-table');const caption=element('caption','mozaik-review-caption','Comparaison avant confirmation');table.append(caption);
    const head=document.createElement('thead'),header=document.createElement('tr');
    const columns=['Élève','Changement',...(report.alignsGestion?['Gestion avant']:[]),'Mozaïk avant','Après confirmation'];
    for(const text of columns){const th=element('th',null,text);th.scope='col';header.append(th);}head.append(header);table.append(head);
    const body=document.createElement('tbody');table.append(body);scroll.append(table);host.append(scroll);
    function render(){
      const rows=selectRows(report,filter.value,search.value);body.replaceChildren();
      visible.textContent=`${counted(rows.length,'ligne affichée','lignes affichées')} sur ${report.counts.total}.`;
      if(!rows.length){const tr=document.createElement('tr'),td=element('td',null,'Aucune ligne ne correspond à ce filtre. Le lot complet reste inchangé.');td.colSpan=columns.length;tr.append(td);body.append(tr);}
      for(const row of rows){
        const tr=document.createElement('tr');tr.dataset.change=row.kind;tr.className=row.attention?'mozaik-review-attention':'';
        tr.append(element('td',null,row.name));
        const kind=element('td');kind.append(element('span',`mozaik-review-badge mozaik-review-${row.kind}`,labels[row.kind]));
        if(row.source==='preserved')kind.append(element('small','mozaik-review-scope','Hors lot de Gestion'));
        if(row.zeroReplacement)kind.append(element('small','mozaik-review-scope','Remplacement par zéro'));
        if(row.codeReplacement)kind.append(element('small','mozaik-review-scope','Code spécial remplacé'));
        tr.append(kind);
        if(report.alignsGestion)tr.append(element('td',null,row.source==='gestion'?formatGrade(row.gestionBeforeGrade,row.gestionBeforeMax):'Hors lot de Gestion'));
        tr.append(element('td',null,formatGrade(row.beforeGrade,row.beforeMax)));
        const target=element('td',null,formatGrade(row.afterGrade,row.afterMax));
        target.append(element('small','mozaik-review-scope',report.alignsGestion&&row.source==='gestion'?'Les deux systèmes':'Mozaïk seulement'));tr.append(target);body.append(tr);
      }
    }
    function canConfirm(){return !report.blocked && acknowledgments.every(input=>input.checked);}
    search.addEventListener('input',render);filter.addEventListener('change',render);render();onReadiness(canConfirm());
    return {report,canConfirm};
  }
  return Object.freeze({analyze,selectRows,formatGrade,mount});
});
