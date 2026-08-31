function configurerAtelier() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone('America/Toronto');
  spreadsheet.setSpreadsheetLocale('fr_CA');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('APP_SECRET')) properties.setProperty('APP_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const layouts = {};
  layouts[TABS.users]=['courriel','nom','role','groupes','actif','creeLe','derniereConnexion'];
  layouts[TABS.groups]=['code','nom','actif'];
  layouts[TABS.assignments]=['id','titre','mode','groupes','matrices','exercices','debut','echeance','tentatives','retroaction','actif','creePar','creeLe'];
  layouts[TABS.results]=['horodatage','remiseId','courriel','nom','groupes','affectationId','titre','mode','exercice','exerciceId','matriceId','score','total','pourcentage','tentative'];
  layouts[TABS.responses]=['horodatage','remiseId','courriel','affectationId','exerciceId','elementId','reponse','reussi'];
  layouts[TABS.answers]=['exerciceId','matriceId','reponsesJson'];
  layouts[TABS.live]=['cle','horodatage','courriel','nom','groupes','affectationId','titre','matriceId','exerciceId','exercice','reponsesJson','reponsesDonnees','reponsesTotal','etat'];
  Object.keys(layouts).forEach(name => { let sheet=spreadsheet.getSheetByName(name);if(!sheet)sheet=spreadsheet.insertSheet(name);const existing=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].filter(String):[];const headers=[...existing,...layouts[name].filter(header=>!existing.includes(header))];if(headers.length)sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#17243c').setFontColor('#ffffff');sheet.setFrozenRows(1); });
  const answers=spreadsheet.getSheetByName(TABS.answers);
  answers.hideSheet();
  const protections=answers.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  const protection=protections.length?protections[0]:answers.protect();
  protection.setDescription('Corrigés privés').setWarningOnly(false);
  const editors=protection.getEditors();
  if(editors.length)protection.removeEditors(editors);
  if(protection.canDomainEdit())protection.setDomainEdit(false);
  try { SpreadsheetApp.getUi().alert('Le tableau est prêt. Ajoute ton adresse dans Utilisateurs avec le rôle enseignant.'); } catch (error) {}
}

function importerCorriges() {
  const fileId=PropertiesService.getScriptProperties().getProperty('ANSWER_BANK_FILE_ID');
  if(!fileId)throw new Error('Ajoute ANSWER_BANK_FILE_ID dans les propriétés du script.');
  const bank=JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')); const rows=Object.keys(bank.exercises).map(id=>[id,bank.exercises[id].matrixId,JSON.stringify(bank.exercises[id].answers)]);
  const sheet=spreadsheet_().getSheetByName(TABS.answers);sheet.getRange(2,1,Math.max(sheet.getMaxRows()-1,1),3).clearContent();if(rows.length)sheet.getRange(2,1,rows.length,3).setValues(rows);sheet.hideSheet();
}

function preparerSuivi() {
  const sheet=ensureLiveSheet_(),lastColumn=14;
  sheet.setHiddenGridlines(true);sheet.setFrozenRows(1);sheet.setRowHeight(1,34);
  sheet.getRange(1,1,1,lastColumn).setFontWeight('bold').setBackground('#17243c').setFontColor('#ffffff').setVerticalAlignment('middle');
  sheet.getBandings().forEach(banding=>banding.remove());sheet.getRange(1,1,2000,lastColumn).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,true,false);
  const range=sheet.getRange(2,1,Math.max(sheet.getMaxRows()-1,1),lastColumn);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('en cours').setBackground('#e1f3e9').setFontColor('#1d6547').setRanges([sheet.getRange('N2:N')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('remis').setBackground('#e5ecf7').setFontColor('#254f77').setRanges([sheet.getRange('N2:N')]).build()
  ]);
  if(!sheet.getFilter())sheet.getRange(1,1,Math.max(sheet.getMaxRows(),2),lastColumn).createFilter();
  range.setVerticalAlignment('middle');return 'Le suivi en direct est prêt.';
}

function creerCompteEleveTest() {
  const current=findUser_('eleve.test@exemple.ca');
  upsert_(TABS.groups,'code','TEST',{code:'TEST',nom:'Groupe de démonstration',actif:true});
  upsert_(TABS.users,'courriel','eleve.test@exemple.ca',{
    courriel:'eleve.test@exemple.ca',
    nom:'Élève test',
    role:'eleve',
    groupes:'TEST',
    actif:true,
    creeLe:(current&&current.creeLe)||new Date(),
    derniereConnexion:(current&&current.derniereConnexion)||''
  });
  upsert_(TABS.assignments,'id','DEMO-TEST',{
    id:'DEMO-TEST',
    titre:'Découverte — exercice test',
    mode:'formatif',
    groupes:'TEST',
    matrices:'10102',
    exercices:'110317',
    debut:'',
    echeance:'',
    tentatives:3,
    retroaction:true,
    actif:true,
    creePar:'système',
    creeLe:new Date()
  });
  return 'Le compte élève test est prêt.';
}
