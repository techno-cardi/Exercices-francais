/** Annual context and immutable assessment membership. No credentials are returned. */
export function yearFailure(message:string):never {const error=new Error(message) as Error&{status:number};error.status=409;throw error;}
export async function yearContext(db:any,requested:any,options:any={}) {
  const {data:catalog,error}=await db.rpc('cardinal_year_catalog');
  if(error||!catalog)yearFailure('Impossible de vérifier l’année scolaire.');
  const supplied=requested!==undefined&&requested!==null&&requested!=='';
  const bound=options.assignment?.school_year;
  let year=supplied?Number(requested):bound??catalog.activeYear;
  let selected=catalog.years?.find((item:any)=>item.year===year);
  if(!selected&&options.fallback&&!options.write){year=catalog.activeYear;selected=catalog.years?.find((item:any)=>item.year===year);}
  if(!Number.isSafeInteger(year)||!selected)yearFailure('Cette année scolaire est introuvable. Actualise Gestion.');
  if(bound!==undefined&&Number(bound)!==year)yearFailure('Ce travail appartient à une autre année. Actualise la liste.');
  if(options.write){
    if(catalog.enforced&&!supplied&&bound===undefined)yearFailure('Actualise Gestion pour confirmer l’année de cette opération.');
    if(selected.status!=='open')yearFailure('Cette année est archivée ou en préparation : consultation seulement.');
    if(options.external&&year!==catalog.activeYear)yearFailure('Les imports et envois sont réservés à l’année active.');
  }
  return {year,...selected,activeYear:catalog.activeYear,isActive:year===catalog.activeYear,readOnly:selected.status!=='open',catalog};
}
export async function assignmentRoster(db:any,assignment:any) {
  const {data,error}=await db.from('school_assignment_roster').select('student_email,school_year,group_code,name,first_name,last_name,source').eq('assignment_id',assignment.id);
  if(error)yearFailure('Impossible de charger la liste historique de ce travail.');
  return (data||[]).map((r:any)=>({...r,email:r.student_email,active:true}));
}
export async function annualEnrollments(db:any,year:number,group?:string) {
  let query=db.from('school_year_enrollments').select('student_email,school_year,group_code,name,first_name,last_name,active').eq('school_year',year);
  if(group)query=query.eq('group_code',group);
  const {data,error}=await query;
  if(error)yearFailure('Impossible de charger les inscriptions de cette année.');
  return (data||[]).map((r:any)=>({...r,email:r.student_email}));
}
const messages:any={
 stale_year_preview:'Les listes ou les données ont changé depuis l’aperçu. Prépare un nouvel aperçu.',
 school_year_pending_mozaik:'Un envoi Mozaïk est encore préparé ou en cours. Termine-le ou résous-le avant le changement d’année.',
 new_student_fiche_required:'Le numéro de fiche à 7 chiffres est requis pour chaque nouvel élève.',
 duplicate_roster_student:'Un courriel apparaît plusieurs fois dans cette liste. Corrige les doublons.',
 school_year_roster_empty:'Importe d’abord la liste des élèves de la nouvelle année.',
 school_year_read_only:'Cette année est archivée : elle est protégée contre les modifications.',
 school_year_context_required:'Actualise Gestion pour confirmer l’année scolaire.',
 school_year_not_active:'Cette opération exige l’année active.',
 archive_via_year_activation:'Pour archiver l’année active, prépare puis active la prochaine année.',
 school_year_already_exists:'Cette année existe déjà. Sélectionne-la dans la liste.',
 school_year_feature_not_ready:'La mise en place des années scolaires n’est pas encore terminée.',
 school_year_activation_requires_future_draft:'Choisis une année future en préparation.',
 year_roster_replace_draft_only:'Le remplacement complet est réservé à une année en préparation.',
 invalid_year_operation_owner:'Cet aperçu est introuvable ou appartient à une autre session.',
 invalid_roster_email:'Une adresse courriel scolaire de la liste est invalide.',
 invalid_roster_fields:'Un nom ou un code de groupe est invalide.',
 preview_expired:'Cet aperçu a expiré. Prépare-le à nouveau.'
};
export async function yearRpc(db:any,name:string,args:any={}) {
  const {data,error}=await db.rpc(name,args);
  if(error){const key=Object.keys(messages).find(key=>String(error.message||'').includes(key));yearFailure(key?messages[key]:'L’opération annuelle n’a pas été enregistrée. Prépare un nouvel aperçu.');}
  return data;
}
function encode64(bytes:Uint8Array){let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
export async function hashRosterFiche(fiche:string) {
  if(!/^\d{7}$/.test(fiche))yearFailure('Le numéro de fiche doit contenir 7 chiffres.');
  const encoder=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iterations=120000;
  const key=await crypto.subtle.importKey('raw',encoder.encode(fiche),'PBKDF2',false,['deriveBits']);
  const digest=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
  return `pbkdf2_sha256$${iterations}$${encode64(salt)}$${encode64(digest)}`;
}
