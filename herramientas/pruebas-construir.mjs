// Pruebas del constructor de la biblioteca:  node herramientas/pruebas-construir.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

let fallos = 0;
const ok = (c, n, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  ← ' + extra)); if (!c) fallos++; };

const caja = mkdtempSync(join(tmpdir(), 'memoria-'));
mkdirSync(join(caja, 'monologues'));
mkdirSync(join(caja, 'herramientas'));
cpSync('herramientas/construir.mjs', join(caja, 'herramientas/construir.mjs'));

writeFileSync(join(caja, 'monologues/con-autor.txt'), 'Hamlet\nShakespeare\n\nTo be,   or not\nto be.\n');
writeFileSync(join(caja, 'monologues/sin-autor.txt'), 'Anónimo\n\nUn texto suelto.\n');
writeFileSync(join(caja, 'monologues/raro.txt'), 'Comillas "y" acentos\nÑ\n\nEl `acento` grave y ${llaves} y \\barras.\n');

execFileSync('node', [join(caja, 'herramientas/construir.mjs')], { stdio: 'pipe' });

const generado = readFileSync(join(caja, 'monologues.js'), 'utf8');
const ventana = {};
new Function('window', generado)(ventana);
const m = Object.fromEntries(ventana.MONOLOGUES.map(x => [x.id, x]));

console.log('\nconstruir.mjs');
ok(ventana.MONOLOGUES.length === 3, 'lee los tres ficheros', ventana.MONOLOGUES.length);
ok(m['con-autor'].title === 'Hamlet' && m['con-autor'].author === 'Shakespeare', 'título y autor');
ok(m['con-autor'].text === 'To be, or not to be.', 'junta los saltos de línea y los espacios de más', JSON.stringify(m['con-autor'].text));
ok(m['sin-autor'].author === '' && m['sin-autor'].text === 'Un texto suelto.', 'aguanta que no haya autor', JSON.stringify(m['sin-autor']));
ok(m['raro'].text === 'El `acento` grave y ${llaves} y \\barras.', 'escapa comillas, acentos graves y barras', JSON.stringify(m['raro'].text));
ok(m['raro'].title === 'Comillas "y" acentos', 'comillas dobles en el título');
ok(ventana.MONOLOGUES.map(x => x.id).join() === 'con-autor,raro,sin-autor', 'orden estable por nombre de fichero');

console.log('\nerrores claros');
writeFileSync(join(caja, 'monologues/vacio.txt'), 'Sólo un título\n');
try {
  execFileSync('node', [join(caja, 'herramientas/construir.mjs')], { stdio: 'pipe' });
  ok(false, 'avisa si un fichero no tiene texto', 'no ha fallado');
} catch (e) {
  ok(/no hay texto/.test(String(e.stderr)), 'avisa si un fichero no tiene texto', String(e.stderr).slice(0, 120));
}

rmSync(caja, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} FALLOS\n` : '\ntodo bien\n');
process.exit(fallos ? 1 : 0);
