(function () {
  'use strict';

  const MAX_ROWS = 1000;
  const aliases = new Map([
    ['email', 'email'], ['courriel', 'email'],
    ['group', 'group'], ['groupe', 'group'],
    ['firstname', 'firstName'], ['prenom', 'firstName'],
    ['lastname', 'lastName'], ['nom', 'lastName'], ['nomdefamille', 'lastName'],
    ['name', 'name'], ['nomcomplet', 'name'],
    ['fiche', 'fiche'], ['numerodefiche', 'fiche'],
    ['active', 'active'], ['actif', 'active']
  ]);

  function fail(message, line) {
    // Location and field names are sufficient; never echo a pupil or credential.
    throw new Error(`${line ? `CSV, ligne ${line}` : 'CSV'} : ${message}`);
  }

  function headerKey(value) {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]+/g, '');
  }

  function delimiterFor(text) {
    const delimiters = [',', ';', '\t'];
    const counts = new Map(delimiters.map(value => [value, 0]));
    let quoted = false, start = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { i++; continue; }
        quoted = !quoted;
      } else if (!quoted && counts.has(c)) {
        counts.set(c, counts.get(c) + 1);
      } else if (!quoted && (c === '\r' || c === '\n')) {
        if (text.slice(start, i).trim()) break;
        counts.forEach((_, key) => counts.set(key, 0));
        start = i + 1;
      }
    }
    if (quoted) fail('Guillemet non fermé.');
    const highest = Math.max(...counts.values());
    if (!highest) fail('Colonnes requises : courriel, groupe et nom.');
    const winners = delimiters.filter(value => counts.get(value) === highest);
    if (winners.length !== 1) fail('Séparateur ambigu. Utilise une virgule, un point-virgule ou une tabulation.');
    return winners[0];
  }

  function recordsFor(text, delimiter) {
    const records = [];
    let cells = [], field = '', quoted = false, closed = false, line = 1, recordLine = 1;
    const fieldEnd = () => { cells.push(field); field = ''; closed = false; };
    const recordEnd = () => {
      fieldEnd();
      if (cells.some(value => value.trim())) {
        records.push({cells, line: recordLine});
        if (records.length > MAX_ROWS + 1) fail(`Maximum de ${MAX_ROWS} élèves par CSV.`, recordLine);
      }
      cells = [];
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closed = true; }
        } else {
          field += c;
          if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++;
        }
      } else if (c === delimiter) {
        fieldEnd();
      } else if (c === '\r' || c === '\n') {
        recordEnd();
        if (c === '\r' && text[i + 1] === '\n') i++;
        recordLine = ++line;
      } else if (closed) {
        if (c !== ' ' && c !== '\t') fail('Caractère inattendu après un guillemet fermé.', line);
      } else if (c === '"') {
        if (field.length) fail('Guillemet inattendu dans un champ non encadré.', line);
        quoted = true;
      } else {
        field += c;
      }
    }
    if (quoted) fail('Guillemet non fermé.', recordLine);
    recordEnd();
    return records;
  }

  function parse(text) {
    if (typeof text !== 'string') fail('Le contenu doit être du texte.');
    text = text.replace(/^\uFEFF/, '');
    if (!text.trim()) fail('Le fichier est vide.');
    const records = recordsFor(text, delimiterFor(text));
    const header = records.shift();
    if (!header) fail('Le fichier est vide.');
    const columns = new Map(), seenHeaders = new Set();
    header.cells.forEach((value, index) => {
      const key = headerKey(value), canonical = aliases.get(key);
      if (!key || seenHeaders.has(key) || (canonical && columns.has(canonical))) {
        fail('En-tête vide ou colonnes en double pour le même champ.', header.line);
      }
      seenHeaders.add(key);
      if (canonical) columns.set(canonical, index);
    });
    if (!columns.has('email') || !columns.has('group') || !['name', 'firstName', 'lastName'].some(key => columns.has(key))) {
      fail('Colonnes requises : courriel, groupe et nom (ou prénom et nom de famille).', header.line);
    }
    if (!records.length) fail('Aucun élève dans le fichier.');

    const seenEmails = new Set();
    return records.map(record => {
      if (record.cells.length !== header.cells.length) fail('Le nombre de champs ne correspond pas aux colonnes.', record.line);
      const get = key => columns.has(key) ? record.cells[columns.get(key)].trim() : '';
      const email = get('email').toLowerCase(), group = get('group');
      const firstName = get('firstName'), lastName = get('lastName');
      const name = get('name') || [firstName, lastName].filter(Boolean).join(' ');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Courriel absent ou invalide.', record.line);
      if (seenEmails.has(email)) fail('Courriel en doublon dans le fichier.', record.line);
      if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/.test(group)) fail('Groupe absent ou invalide.', record.line);
      if (!name) fail('Nom absent.', record.line);
      const fiche = get('fiche');
      if (fiche && !/^\d{7}$/.test(fiche)) fail('Le numéro de fiche doit contenir exactement 7 chiffres.', record.line);
      const rawActive = get('active').toLowerCase();
      const truthy = ['', 'true', 'vrai', 'yes', 'oui', '1'];
      const falsy = ['false', 'faux', 'no', 'non', '0'];
      if (!truthy.includes(rawActive) && !falsy.includes(rawActive)) fail('Valeur actif invalide : utilise oui/non ou true/false.', record.line);
      seenEmails.add(email);
      const row = {email, group, firstName, lastName, name, active: truthy.includes(rawActive)};
      if (fiche) row.fiche = fiche;
      return row;
    });
  }

  window.CardinalYearRosterCsv = Object.freeze({parse});
})();
