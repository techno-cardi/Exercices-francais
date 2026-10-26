// Test-only PostgreSQL WASM runtime, pinned and integrity-checked. No database credentials.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./sql-runtime/',import.meta.url));
const expected='IiAxv1ld1V9QP0AWsflliDqrGRo+20O+yXOr2fjk6YzBHsCvTPclwQhCB1uZ7eHtPrxUrSllNzWgqy/Ot76PEw==';
const response=await fetch('https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.12.tgz');
if(!response.ok)throw Error(`Download failed ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(createHash('sha512').update(bytes).digest('base64')!==expected)throw Error('Runtime integrity mismatch');
await mkdir(dir,{recursive:true});await writeFile(dir+'package.tgz',bytes);
execFileSync('tar',['-xf',dir+'package.tgz','-C',dir],{stdio:'inherit'});
console.log('Installed test-only @electric-sql/pglite 0.5.12. Run node resultats/tests/sql-imports.test.mjs');
