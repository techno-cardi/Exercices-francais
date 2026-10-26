const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function parser() {
  const context = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../year-roster-csv.js'), 'utf8'), context);
  return text => JSON.parse(JSON.stringify(context.window.CardinalYearRosterCsv.parse(text)));
}

test('French semicolon CSV handles BOM, CRLF, leading zeros and default active state', () => {
  const rows = parser()('\uFEFFcourriel;groupe;prénom;nom;numéro de fiche\r\n ALICE@EXAMPLE.INVALID ;031;Alice;Exemple;0012345\r\n');
  assert.deepEqual(rows, [{email: 'alice@example.invalid', group: '031', firstName: 'Alice', lastName: 'Exemple', name: 'Alice Exemple', fiche: '0012345', active: true}]);
});

test('comma CSV preserves quoted delimiters, escaped quotes and multiline fields', () => {
  const rows = parser()('email,group,name\na@example.invalid,A-2,"Alice, dite ""A""\nExemple"\n');
  assert.deepEqual(rows, [{email: 'a@example.invalid', group: 'A-2', firstName: '', lastName: '', name: 'Alice, dite "A"\nExemple', active: true}]);
});

test('tab-separated English fields and explicit full name work without personal-data APIs', () => {
  const rows = parser()('email\tgroup\tfirstName\tlastName\tname\tactive\na@example.invalid\t007\tAlice\tExample\tAlice Example Jr.\tFALSE\n');
  assert.deepEqual(rows, [{email: 'a@example.invalid', group: '007', firstName: 'Alice', lastName: 'Example', name: 'Alice Example Jr.', active: false}]);
});

test('French family/full-name aliases, decomposed accents and blank optional cells are accepted', () => {
  const rows = parser()('courriel;groupe;pre\u0301nom;nom de famille;nom complet;fiche;actif\na@example.invalid;77;Alice;Exemple;;;\n');
  assert.deepEqual(rows, [{email: 'a@example.invalid', group: '77', firstName: 'Alice', lastName: 'Exemple', name: 'Alice Exemple', active: true}]);
  assert.equal(parser()('email,groupe,nomcomplet\na@example.invalid,31,Alice Exemple')[0].name, 'Alice Exemple');
});

test('quoted headers and delimiters inside quoted names do not confuse delimiter detection', () => {
  const rows = parser()('"email";"group";"name"\r\na@example.invalid;31;"Alice, Example\tJunior"');
  assert.equal(rows[0].name, 'Alice, Example\tJunior');
});

test('blank lines are ignored and unrelated export columns do not alter roster data', () => {
  const rows = parser()('\r\nemail,group,name,externalId\r\n\r\na@example.invalid,31,Alice,abc\r\n,,,\r\n');
  assert.equal(rows.length, 1);
  assert.equal(Object.hasOwn(rows[0], 'externalId'), false);
});

test('active accepts explicit French/English booleans and rejects ambiguous values', () => {
  for (const [value, expected] of [['oui', true], ['YES', true], ['vrai', true], ['true', true], ['1', true], ['non', false], ['NO', false], ['faux', false], ['false', false], ['0', false]]) {
    assert.equal(parser()(`email,group,name,actif\na@example.invalid,31,Alice,${value}`)[0].active, expected);
  }
  for (const value of ['peut-être', '2', '-1']) {
    assert.throws(() => parser()(`email,group,name,actif\na@example.invalid,31,Alice,${value}`), /actif/i);
  }
});

test('duplicate canonical headers are rejected even when their row values agree', () => {
  for (const header of ['email,courriel,group,name', 'email,group,name,nomcomplet', 'email,group,firstName,prénom,nom']) {
    assert.throws(() => parser()(header + '\na@example.invalid,a@example.invalid,31,Alice,Alice'), /colonne|en-tête/i);
  }
});

test('case-normalized duplicate emails are rejected rather than merged or overwritten', () => {
  assert.throws(() => parser()('email,group,name\na@example.invalid,31,Alice\n A@EXAMPLE.INVALID ,77,Autre'), /doublon|plusieurs|déjà/i);
});

test('missing required header or row identity is rejected', () => {
  const parse = parser();
  for (const text of ['group,name\n31,Alice', 'email,name\na@example.invalid,Alice', 'email,group\na@example.invalid,31', 'email,group,name\n,31,Alice', 'email,group,name\na@example.invalid,,Alice', 'email,group,name\na@example.invalid,31,']) {
    assert.throws(() => parse(text), /courriel|groupe|nom|colonne/i);
  }
  assert.throws(() => parse('email,group,name\ninvalid,31,Alice'), /courriel/i);
});

test('invalid group codes and provided fiche values reject without echoing personal fields', () => {
  const parse = parser();
  for (const group of ['<bad>', 'A B', '-31', 'A'.repeat(41)]) {
    assert.throws(() => parse(`email,group,name\na@example.invalid,${group},Synthetic Private Name`), /groupe/i);
  }
  for (const fiche of ['123456', '12345678', '12a4567', '1e00000']) {
    assert.throws(() => parse(`email,group,name,fiche\na@example.invalid,31,Synthetic Private Name,${fiche}`), error => /fiche/i.test(error.message) && !/Synthetic|a@example|123456|12a4567|1e00000/.test(error.message));
  }
});

test('malformed quotes and row-width mismatches fail before any rows are returned', () => {
  const parse = parser();
  for (const text of ['email,group,name\na@example.invalid,31,"Alice', 'email,group,name\na@example.invalid,31,Ali"ce', 'email,group,name\na@example.invalid,31,"Alice"oops', 'email,group,name\na@example.invalid,31', 'email,group,name\na@example.invalid,31,Alice,extra']) {
    assert.throws(() => parse(text), /guillemet|colonne|champ/i);
  }
});

test('max 1000 nonempty data rows is enforced and parser calls keep no previous roster state', () => {
  const parse = parser();
  const lines = Array.from({length: 1001}, (_, i) => `p${i}@example.invalid,31,Synthetic ${i}`);
  assert.equal(parse('email,group,name\n' + lines.slice(0, 1000).join('\n')).length, 1000);
  assert.throws(() => parse('email,group,name\n' + lines.join('\n')), /1000|1 000/);
  assert.equal(parse('email,group,name\np0@example.invalid,77,Again').length, 1);
});

test('empty input, header-only input and non-text input do not produce an accidental empty replacement', () => {
  const parse = parser();
  for (const input of ['', '\uFEFF\r\n', 'email,group,name\n', null, undefined, 42]) {
    assert.throws(() => parse(input), /CSV|texte|élève|vide/i);
  }
});
