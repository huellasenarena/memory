// Pruebas del motor de texto:  node pruebas.js
globalThis.window = globalThis;
require('./texto.js');
require('./monologues.js');
var T = globalThis.Texto, fallos = 0;

function ok(cond, nombre, extra) {
  if (cond) { console.log('  ✓ ' + nombre); }
  else { fallos++; console.log('  ✗ ' + nombre + (extra ? '\n      ' + extra : '')); }
}

// Las pruebas del motor miden SIEMPRE el mismo texto, se llame como se llame
// y haya los monologos que haya en la biblioteca. Cogerlo por posicion
// ([0]) ataba estas pruebas al contenido de monologues/.
var patron = globalThis.MONOLOGUES.find(function (m) { return m.id === 'turin-horse'; });
if (!patron) {
  console.error('\nFalta monologues/turin-horse.txt, que es el texto de referencia.\n');
  process.exit(1);
}
var texto = patron.text;

console.log('\ntrocear');
[8, 11, 15].forEach(function (max) {
  var u = T.trocear(texto, max);
  var n = u.map(function (x) { return x.split(/\s+/).length; });
  var largos = n.filter(function (x) { return x > max; }).length;
  var palabras = u.join(' ').split(/\s+/).length;
  console.log('  max ' + max + ' → ' + u.length + ' trozos, de ' +
              Math.min.apply(null, n) + ' a ' + Math.max.apply(null, n) + ' palabras');
  ok(largos === 0, 'ningun trozo pasa de ' + max + ' palabras', largos + ' se pasan');
  ok(palabras === 592, 'no se pierde ni se inventa ninguna palabra (' + palabras + ')');
  ok(u.join(' ') === texto.trim().replace(/\s+/g, ' '), 'los trozos reconstruyen el texto original');
});

console.log('\niniciales');
ok(T.iniciales("The wind's blown it away.") === "T w's b i a.", "The wind's blown it away. → T w's b i a.",
   T.iniciales("The wind's blown it away."));
ok(T.iniciales('Until the triumphant end.') === 'U t t e.', 'Until the triumphant end. → U t t e.');

console.log('\ncomparar (tolerancia)');
function cmp(a, b) { return T.comparar(a, b).exacto; }
ok(cmp("It's gone to ruin.", 'its gone to ruin'), 'ignora mayusculas, apostrofos y puntuacion');
ok(cmp("they've debased", 'theyve debased'), 'ignora el apostrofo interno');
ok(cmp('so-called innocent', 'so called innocent'), 'acepta el guion como espacio');
ok(!cmp("everything's in ruins", "everything's in ruin"), 'singular y plural NO son lo mismo');
ok(!cmp("they've acquired", 'they acquired'), 'una palabra que falta se detecta');
ok(!cmp('the great and the noble', 'the great and noble'), 'detecta la palabra omitida en medio');

console.log('\ncomparar (senala la palabra exacta)');
var m = T.palabrasMarcadas('the excellent, the great and the noble', 'the excellent the great and noble');
ok(m.palabras.filter(function (p) { return !p.ok; }).map(function (p) { return p.palabra; }).join(',') === 'the',
   'marca solo la palabra que falta',
   JSON.stringify(m.palabras.filter(function (p) { return !p.ok; })));
ok(m.aciertos === 6 && m.total === 7, 'cuenta 6 de 7 aciertos', m.aciertos + '/' + m.total);

console.log('\ncontar palabras (una sola cuenta en toda la app)');
var n = T.contarPalabras(texto);
ok(n === 588, 'el monologo tiene ' + n + ' palabras contables (592 tokens - 4 rayas sueltas)');
var todo = T.palabrasMarcadas(texto, texto);
ok(todo.total === n, 'corregir usa la misma cuenta que la portada', todo.total + ' vs ' + n);
ok(todo.aciertos === n && todo.exacto, 'escribirlo identico da la nota maxima');

console.log('\npuntos');
ok(T.puntos('Until the triumphant end.') === '· · · ·', 'un punto por palabra');

console.log(fallos ? '\n' + fallos + ' FALLOS\n' : '\ntodo bien\n');
process.exit(fallos ? 1 : 0);
