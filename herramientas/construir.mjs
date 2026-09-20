// Convierte monologues/*.txt en monologues.js, que es lo que carga la app.
//
//   node herramientas/construir.mjs
//
// Se ejecuta solo en GitHub cada vez que cambia algo en monologues/, así que
// normalmente no hace falta lanzarlo a mano. Sirve para ver el resultado antes
// de hacer push.
//
// Formato de cada .txt:
//
//   Título
//   Autor              ← opcional; si no hay, deja la línea en blanco
//                      ← una línea en blanco
//   El texto...

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = join(raiz, 'monologues');

function leer(fichero) {
  const crudo = readFileSync(join(carpeta, fichero), 'utf8').replace(/\r\n/g, '\n');
  const lineas = crudo.split('\n');

  const title = (lineas.shift() || '').trim();
  let author = '';
  if (lineas.length && lineas[0].trim()) author = lineas.shift().trim();
  while (lineas.length && !lineas[0].trim()) lineas.shift();

  const text = lineas.join('\n').trim().replace(/\s+/g, ' ');
  const id = basename(fichero, '.txt');

  if (!title) throw new Error(`${fichero}: falta el título en la primera línea`);
  if (!text) throw new Error(`${fichero}: no hay texto después del título`);
  return { id, title, author, text };
}

const monologos = readdirSync(carpeta)
  .filter(f => f.endsWith('.txt'))
  .sort()
  .map(leer);

const cita = s => JSON.stringify(s);

const salida = `// GENERADO — no editar a mano.
// La fuente son los ficheros de monologues/*.txt.
// Lo regenera herramientas/construir.mjs, y GitHub lo hace solo en cada push.

window.MONOLOGUES = [
${monologos.map(m => `  {
    id: ${cita(m.id)},
    title: ${cita(m.title)},
    author: ${cita(m.author)},
    text: ${cita(m.text)}
  }`).join(',\n')}
];
`;

writeFileSync(join(raiz, 'monologues.js'), salida);

monologos.forEach(m => {
  console.log(`  ${m.id.padEnd(24)} ${String(m.text.split(/\s+/).length).padStart(5)} palabras  ${m.title}`);
});
console.log(`\nmonologues.js reescrito con ${monologos.length} texto${monologos.length === 1 ? '' : 's'}.`);
