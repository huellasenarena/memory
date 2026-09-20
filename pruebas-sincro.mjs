// Dos perfiles de Chrome = dos aparatos distintos, contra el Worker de verdad.
//
//   FRASE=... node pruebas-sincro.mjs                      ← el sitio publicado
//   FRASE=... node pruebas-sincro.mjs http://localhost:8787/index.html
//
// OJO: escribe y borra en la base de datos de verdad. Úsala cuando no tengas
// nada que perder, o vacía la tabla antes con:
//   wrangler d1 execute memoria --remote --command "delete from monologos;"


import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRASE = process.env.FRASE;
if (!FRASE) { console.error('\nFalta la frase:  FRASE=... node pruebas-sincro.mjs\n'); process.exit(1); }
const BASE = process.argv[2] || 'https://huellasenarena.github.io/memory/';
const esperar = ms => new Promise(r => setTimeout(r, ms));
let fallos = 0;
const ok = (c, n, x) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  ← ' + x)); if (!c) fallos++; };

async function aparato(nombre, puerto) {
  const perfil = `/tmp/chrome-${nombre}`;
  rmSync(perfil, { recursive: true, force: true });
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${puerto}`,
    '--no-first-run', `--user-data-dir=${perfil}`, '--window-size=900,800', 'about:blank'], { stdio: 'ignore' });
  await esperar(2600);
  const lista = await (await fetch(`http://localhost:${puerto}/json/list`)).json();
  const ws = new WebSocket(lista.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let i = 0; const p = new Map(); const errores = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.text); });
  const env = (me, pa = {}) => new Promise(r => { const n = ++i; p.set(n, r); ws.send(JSON.stringify({ id: n, method: me, params: pa })); });
  await env('Runtime.enable'); await env('Page.enable');
  const ev = async x => (await env('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.result.value;
  const ir = async () => { await env('Page.navigate', { url: BASE }); await esperar(1500); };
  await ir();
  return { nombre, ev, ir, errores, cerrar: () => { ws.close(); proc.kill(); } };
}

const A = await aparato('aparato-a', 9341);
const B = await aparato('aparato-b', 9342);

console.log('\naparato A — activar la sincronización');
await A.ev(`Almacen.frase(${JSON.stringify(FRASE)}); 'ok'`);
ok(await A.ev('Almacen.sincronizar()') === true, 'sincroniza sin error', await A.ev('Almacen.estado().error'));
await esperar(800);
ok((await A.ev('Almacen.monologos().length')) === 1, 'sigue teniendo el monólogo del repo');

console.log('\naparato A — añadir un texto desde la app');
await A.ev("document.querySelector('[data-ir=anadir]').click(); 'ok'");
await A.ev(`document.getElementById('nuevo-titulo').value='Ricardo III';
            document.getElementById('nuevo-autor').value='Shakespeare';
            document.getElementById('nuevo-texto').value='Ahora es el invierno de nuestro descontento.';
            document.getElementById('guardar-nuevo').click(); 'ok'`);
await esperar(2500);
ok((await A.ev("Almacen.monologos().map(m=>m.title).join(' | ')")).includes('Ricardo III'), 'aparece al instante en la lista');
ok(await A.ev('Almacen.estado().error') === '', 'sin error al subirlo', await A.ev('Almacen.estado().error'));

console.log('\naparato A — ensayar un poco');
await A.ev("document.querySelector('.volver')?.click(); 'ok'");
await A.ev(`var b=[...document.querySelectorAll('#lista .titulo')].find(x=>x.textContent==='The Turin Horse'); b.click(); 'ok'`);
await esperar(400);
await A.ev(`window.__e=function(s){var t=document.getElementById('entrada');t.value=s;
  t.dispatchEvent(new Event('input',{bubbles:true}));
  t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));};
  var a=document.getElementById('apunte');
  __e(a.textContent); 'ok'`);
await esperar(300);
const nivelA = await A.ev("Almacen.nivel('turin-horse', \"The wind's blown it away.\")");
ok(nivelA === 1, 'el trozo sube a nivel 1', nivelA);
await esperar(2500);

console.log('\naparato B — misma frase, parte de cero');
ok((await B.ev('Almacen.monologos().length')) === 1, 'antes de sincronizar sólo ve el del repo');
await B.ev(`Almacen.frase(${JSON.stringify(FRASE)}); 'ok'`);
ok(await B.ev('Almacen.sincronizar()') === true, 'sincroniza sin error', await B.ev('Almacen.estado().error'));
await esperar(600);
const titulosB = await B.ev("Almacen.monologos().map(m=>m.title).sort().join(' | ')");
ok(titulosB === 'Ricardo III | The Turin Horse', 'le llega el texto añadido en A', titulosB);
const nivelB = await B.ev("Almacen.nivel('turin-horse', \"The wind's blown it away.\")");
ok(nivelB === 1, 'y también el progreso de A', nivelB);

console.log('\naparato B — añadir otro y que vuelva a A');
await B.ev(`Almacen.guardar({id:'macbeth', title:'Macbeth', author:'Shakespeare', text:'Mañana, y mañana, y mañana.'}); 'ok'`);
await esperar(2500);
await A.ev('Almacen.sincronizar()');
await esperar(500);
const titulosA = await A.ev("Almacen.monologos().map(m=>m.title).sort().join(' | ')");
ok(titulosA === 'Macbeth | Ricardo III | The Turin Horse', 'A ve lo que se añadió en B', titulosA);

console.log('\nborrar en un sitio no resucita desde el otro');
await A.ev("Almacen.borrar('macbeth'); 'ok'");
await esperar(2500);
await B.ev('Almacen.sincronizar()');
await esperar(500);
ok(!(await B.ev("Almacen.monologos().map(m=>m.title).join('|')")).includes('Macbeth'), 'B también lo pierde');
await A.ev('Almacen.sincronizar()');
await esperar(400);
ok(!(await A.ev("Almacen.monologos().map(m=>m.title).join('|')")).includes('Macbeth'), 'y no vuelve a A en la siguiente vuelta');

console.log('\nsin red la app sigue viva');
await A.ev("window.fetch=function(){return Promise.reject(new Error('sin red'));}; 'ok'");
await A.ev("Almacen.guardar({id:'offline', title:'Sin red', author:'', text:'Escrito sin conexión.'}); 'ok'");
await esperar(2000);
ok((await A.ev("Almacen.monologos().map(m=>m.title).join('|')")).includes('Sin red'), 'se guarda igual en local');
ok((await A.ev('Almacen.estado().error')).length > 0, 'y avisa de que no pudo sincronizar', await A.ev('Almacen.estado().error'));
await A.ir();   // recargar: vuelve fetch de verdad
await A.ev(`Almacen.frase(${JSON.stringify(FRASE)}); 'ok'`);
await A.ev('Almacen.sincronizar()');
await esperar(600);
await B.ev('Almacen.sincronizar()');
await esperar(600);
ok((await B.ev("Almacen.monologos().map(m=>m.title).join('|')")).includes('Sin red'), 'al volver la red sube lo pendiente');

console.log('\nfrase incorrecta');
await B.ev("Almacen.frase('chorizo-chorizo'); 'ok'");
ok(await B.ev('Almacen.sincronizar()') === false, 'no sincroniza');
ok((await B.ev('Almacen.estado().error')).includes('frase'), 'y lo dice claro', await B.ev('Almacen.estado().error'));

const errs = [...A.errores, ...B.errores];
console.log(errs.length ? '\nERRORES JS: ' + errs.join(' | ') : '\nconsola limpia');
console.log(fallos ? `\n${fallos} FALLOS\n` : '\ntodo bien\n');
A.cerrar(); B.cerrar();
process.exit(fallos || errs.length ? 1 : 0);
