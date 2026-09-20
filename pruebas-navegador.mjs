// Prueba de humo end-to-end con Chrome headless, por el protocolo DevTools.
// No hace falta instalar nada.
//
//   node pruebas-navegador.mjs                      ← contra el sitio publicado
//   node pruebas-navegador.mjs http://localhost:8787/index.html
//
// Para probar en local primero: python3 -m http.server 8787
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PERFIL = '/tmp/chrome-memoria-pruebas';
rmSync(PERFIL, { recursive: true, force: true });   // sin esto, el progreso guardado falsea las pruebas
const PORT = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  `--user-data-dir=${PERFIL}`, '--window-size=900,900', 'about:blank'
], { stdio: 'ignore' });

const esperar = ms => new Promise(r => setTimeout(r, ms));
await esperar(2500);

const lista = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
const pagina = lista.find(t => t.type === 'page');
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));

let id = 0;
const pendientes = new Map();
const errores = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map(a => a.value).join(' '));
});
const enviar = (method, params = {}) => new Promise(r => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await enviar('Runtime.enable');
await enviar('Page.enable');

const ev = async expr => {
  const r = await enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};

const CAPTURAS = process.env.CAPTURAS;   // CAPTURAS=1 node pruebas-navegador.mjs
const foto = async nombre => {
  if (!CAPTURAS) return;
  const r = await enviar('Page.captureScreenshot', { format: 'png' });
  writeFileSync(nombre, Buffer.from(r.result.data, 'base64'));
};

const DESTINO = process.argv[2] || 'https://huellasenarena.github.io/memory/';
await enviar('Page.navigate', { url: DESTINO });
await esperar(1200);

const paso = (n, v, extra='') => console.log((v ? '  ✓ ' : '  ✗ ') + n + (v ? '' : '  ← ' + extra));

console.log('\narranque  (' + DESTINO + ')');
paso('sin errores de JS', errores.length === 0, errores.join(' | '));
paso('vista inicial = biblioteca', await ev('document.body.dataset.vista') === 'biblioteca');
paso('el monólogo aparece en la lista', (await ev("document.querySelector('#lista .titulo')?.textContent")) === 'The Turin Horse');

console.log('\nentrar al ensayo');
await ev("document.querySelector('#lista .titulo').click()");
await esperar(200);
paso('vista = ensayo', await ev('document.body.dataset.vista') === 'ensayo');
paso('paso 1 enseña el texto', (await ev("document.getElementById('apunte').textContent")) === "The wind's blown it away.");
paso('contador arranca en 1', (await ev("document.getElementById('contador').textContent")).startsWith('1 / '));
await foto('01-ensayo.png');

// Escribir en el textarea y pulsar Enter de verdad.
await ev(`window.__escribir = function (txt) {
  var t = document.getElementById('entrada');
  t.value = txt;
  t.dispatchEvent(new Event('input', {bubbles:true}));
  t.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
}; 'ok'`);

console.log('\nrespuesta correcta (con tolerancia)');
await ev("__escribir(\"the winds blown it away\")");
await esperar(150);
paso('sube al paso 2 (iniciales)', (await ev("document.getElementById('apunte').textContent")) === "T w's b i a.");
paso('los 2 primeros puntos están llenos', (await ev("document.querySelectorAll('#pasos i.lleno').length")) === 2);
await foto('02-iniciales.png');

await ev("__escribir(\"The wind's blown it away.\")");
await esperar(150);
paso('sube al paso 3 (puntos)', (await ev("document.getElementById('apunte').textContent")) === '· · · · ·');
await foto('03-puntos.png');

console.log('\nfallo');
await ev("__escribir('The wind has blown it away')");
await esperar(150);
paso('marca la palabra fallada', (await ev("[...document.querySelectorAll('#apunte .fallo')].map(s=>s.textContent).join(',')")) === "wind's");
paso('cuenta los aciertos', (await ev("document.getElementById('veredicto').textContent")) === '4 de 5 palabras');
paso('baja de paso', (await ev("document.querySelectorAll('#pasos i.lleno').length")) === 2);
await foto('04-fallo.png');

console.log('\nseguir tras el fallo');
await ev("__escribir('')");
await esperar(150);
paso('enter continúa y vuelve a las iniciales', (await ev("document.getElementById('apunte').textContent")) === "T w's b i a.");

console.log('\nenseñar la respuesta con el campo vacío');
await ev("__escribir('')");
await esperar(150);
paso('enseña el texto entero', (await ev("document.getElementById('apunte').textContent")) === "The wind's blown it away.");
paso('lo dice sin regañar', (await ev("document.getElementById('veredicto').textContent")) === 'ahí lo tienes');

console.log('\ndominar el trozo y pasar al siguiente');
await ev("__escribir('')");             // seguir
await esperar(100);
await ev("__escribir(\"The wind's blown it away.\")");  // paso 1 -> 2
await esperar(100);
await ev("__escribir(\"The wind's blown it away.\")");  // paso 2 -> 3
await esperar(100);
await ev("__escribir(\"The wind's blown it away.\")");  // paso 3 -> dominado
await esperar(150);
paso('pasa al trozo 2', (await ev("document.getElementById('contador').textContent")).startsWith('2 / '));
paso('el anterior queda de rastro', (await ev("document.getElementById('rastro').textContent")) === "The wind's blown it away.");
paso('la barra avanza', (await ev("document.querySelector('#barra i').style.width")) !== '0%');
await foto('05-trozo2.png');

console.log('\ncambiar el tamaño de los trozos');
const antes = await ev("document.getElementById('contador').textContent.split(' / ')[1]");
await ev("[...document.querySelectorAll('#trozos .enlace')].find(b=>b.textContent==='15').click()");
await esperar(200);
const despues = await ev("document.getElementById('contador').textContent.split(' / ')[1]");
paso('cambia el número de trozos (' + antes + ' → ' + despues + ')', antes !== despues);
paso('no se pierde el progreso', (await ev("JSON.parse(localStorage.getItem('memoria.v1')).progreso['turin-horse'] ? Object.keys(JSON.parse(localStorage.getItem('memoria.v1')).progreso['turin-horse']).length : 0")) > 0);

console.log('\nel monólogo entero');
await ev("document.querySelector('.volver').click()");
await esperar(150);
await ev("[...document.querySelectorAll('#lista .enlace')].find(b=>b.textContent==='entero').click()");
await esperar(200);
paso('vista = entero', await ev('document.body.dataset.vista') === 'entero');
await ev("document.getElementById('entrada-entero').value = window.MONOLOGUES[0].text.split(' ').slice(0,20).join(' '); document.getElementById('corregir-entero').click(); 'ok'");
await esperar(250);
paso('corrige y puntúa', /^\d+ de 588 palabras/.test(await ev("document.querySelector('#resultado-entero .meta').textContent")));
await foto('06-entero.png');

console.log('\nmóvil (390×844)');
await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await ev("document.querySelector('.volver').click()");
await esperar(150);
await ev("document.querySelector('#lista .titulo').click()");
await esperar(250);
paso('sin scroll horizontal', (await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth')) === true);
await foto('07-movil.png');

console.log('\nmodo oscuro');
await enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await esperar(300);
await foto('08-oscuro.png');
paso('el fondo se vuelve negro', (await ev("getComputedStyle(document.body).backgroundColor")) === 'rgb(0, 0, 0)');

console.log(errores.length ? '\nERRORES DE CONSOLA:\n' + errores.join('\n') : '\nconsola limpia');
ws.close(); chrome.kill(); process.exit(0);
