// Añade un monólogo desde la terminal, en un solo comando.
//
//   pbpaste | node herramientas/nuevo.mjs "Hamlet" "Shakespeare"
//   node herramientas/nuevo.mjs "Hamlet" "Shakespeare" < hamlet.txt
//
// Crea monologues/hamlet.txt, regenera monologues.js y te dice qué commitear.

import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [title, author = ''] = process.argv.slice(2);

if (!title) {
  console.error('Falta el título.\n\n  pbpaste | node herramientas/nuevo.mjs "Hamlet" "Shakespeare"\n');
  process.exit(1);
}

const texto = await new Promise(r => {
  let b = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => (b += d));
  process.stdin.on('end', () => r(b.trim()));
});

if (!texto) {
  console.error('No ha llegado ningún texto por la entrada estándar.');
  process.exit(1);
}

const apodo = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'texto';

let id = apodo, n = 2;
while (existsSync(join(raiz, 'monologues', `${id}.txt`))) id = `${apodo}-${n++}`;

const destino = join(raiz, 'monologues', `${id}.txt`);
writeFileSync(destino, `${title}\n${author}\n\n${texto}\n`);
console.log(`\nmonologues/${id}.txt escrito.\n`);

execFileSync('node', [join(raiz, 'herramientas', 'construir.mjs')], { stdio: 'inherit' });

console.log(`\nPara publicarlo:\n\n  git add -A && git commit -m "Añadir ${title}" && git push\n`);
