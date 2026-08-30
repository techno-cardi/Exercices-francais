function configurerAtelier() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone('America/Toronto');
  spreadsheet.setSpreadsheetLocale('fr_CA');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('APP_SECRET')) properties.setProperty('APP_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const layouts = {};
  layouts[TABS.users]=['courriel','nom','role','groupes','actif','creeLe'];
  layouts[TABS.groups]=['code','nom','actif'];
  layouts[TABS.assignments]=['id','titre','mode','groupes','matrices','exercices','debut','echeance','tentatives','retroaction','actif','creePar','creeLe'];
  layouts[TABS.results]=['horodatage','remiseId','courriel','nom','groupes','affectationId','titre','mode','exercice','exerciceId','matriceId','score','total','pourcentage','tentative'];
  layouts[TABS.responses]=['horodatage','remiseId','courriel','affectationId','exerciceId','elementId','reponse','reussi'];
  layouts[TABS.answers]=['exerciceId','matriceId','reponsesJson'];
  Object.keys(layouts).forEach(name => { let sheet=spreadsheet.getSheetByName(name);if(!sheet)sheet=spreadsheet.insertSheet(name);const existing=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].filter(String):[];const headers=[...existing,...layouts[name].filter(header=>!existing.includes(header))];if(headers.length)sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#17243c').setFontColor('#ffffff');sheet.setFrozenRows(1); });
  const answers=spreadsheet.getSheetByName(TABS.answers);
  answers.hideSheet();
  const protections=answers.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  const protection=protections.length?protections[0]:answers.protect();
  protection.setDescription('Corrigés privés').setWarningOnly(false);
  const editors=protection.getEditors();
  if(editors.length)protection.removeEditors(editors);
  if(protection.canDomainEdit())protection.setDomainEdit(false);
  SpreadsheetApp.getUi().alert('Le tableau est prêt. Ajoute ton adresse dans Utilisateurs avec le rôle enseignant.');
}

function importerCorriges() {
  const fileId=PropertiesService.getScriptProperties().getProperty('ANSWER_BANK_FILE_ID');
  if(!fileId)throw new Error('Ajoute ANSWER_BANK_FILE_ID dans les propriétés du script.');
  const bank=JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')); const rows=Object.keys(bank.exercises).map(id=>[id,bank.exercises[id].matrixId,JSON.stringify(bank.exercises[id].answers)]);
  const sheet=spreadsheet_().getSheetByName(TABS.answers);sheet.getRange(2,1,Math.max(sheet.getMaxRows()-1,1),3).clearContent();if(rows.length)sheet.getRange(2,1,rows.length,3).setValues(rows);sheet.hideSheet();
}

function onOpen(){SpreadsheetApp.getUi().createMenu('Atelier de français').addItem('Préparer le tableau','configurerAtelier').addItem('Définir le mot de passe enseignant','definirMotDePasseEnseignant').addItem('Importer les corrigés','importerCorriges').addToUi();}

function definirMotDePasseEnseignant(){const ui=SpreadsheetApp.getUi(),answer=ui.prompt('Mot de passe enseignant','Choisis un mot de passe long et unique.',ui.ButtonSet.OK_CANCEL);if(answer.getSelectedButton()!==ui.Button.OK)return;const password=answer.getResponseText();if(password.length<10)throw new Error('Le mot de passe doit contenir au moins 10 caractères.');PropertiesService.getScriptProperties().setProperty('TEACHER_PASSWORD_HASH',digest_(password));ui.alert('Le mot de passe enseignant est enregistré.');}
