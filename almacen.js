// Único punto de contacto con el almacenamiento.
//
// Local-first: todo se escribe en localStorage y se lee de localStorage, así
// que la app pinta al instante y funciona sin red. La base de datos es sólo el
// puente entre aparatos, y se sincroniza por detrás.
//
//   escribes  →  localStorage  →  pantalla        (siempre, al instante)
//                     ↓
//               Worker + D1                       (cuando hay red y frase)
//
// Cada registro lleva un `cuando`. Al sincronizar gana el más reciente, de modo
// que dos aparatos no se pisan. Los borrados son suaves: si quitáramos la fila,
// el otro aparato la volvería a subir.

(function (root) {
  'use strict';

  var CLAVE = 'memoria.v2';
  var VIEJA = 'memoria.v1';
  var SERVIDOR = 'https://memoria.georg-dreym.workers.dev';

  var oyentes = [];
  var sincronizando = false;
  var ultimoError = '';

  function vacio() {
    return { monologos: {}, progreso: {}, ajustes: {}, frase: '', sincronizado: 0 };
  }

  function leer() {
    var datos;
    try {
      datos = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    } catch (e) { datos = null; }

    if (!datos || typeof datos !== 'object') {
      datos = migrar() || vacio();
      escribir(datos);
    }
    datos.monologos = datos.monologos || {};
    datos.progreso = datos.progreso || {};
    datos.ajustes = datos.ajustes || {};
    return datos;
  }

  // El formato viejo guardaba el nivel a secas, sin fecha, y los textos
  // propios en una lista aparte. Se convierte una sola vez.
  function migrar() {
    var viejo;
    try { viejo = JSON.parse(localStorage.getItem(VIEJA) || 'null'); } catch (e) { return null; }
    if (!viejo) return null;

    var datos = vacio();
    var cuando = Date.now();

    Object.keys(viejo.progreso || {}).forEach(function (id) {
      datos.progreso[id] = {};
      Object.keys(viejo.progreso[id]).forEach(function (trozo) {
        var v = viejo.progreso[id][trozo];
        datos.progreso[id][trozo] = typeof v === 'number'
          ? { nivel: v, cuando: cuando }
          : { nivel: Number(v && v.nivel) || 0, cuando: Number(v && v.cuando) || cuando };
      });
    });

    (viejo.propios || []).forEach(function (m) {
      datos.monologos[m.id] = {
        id: m.id, title: m.title, author: m.author || '', text: m.text,
        cuando: cuando, borrado: 0
      };
    });

    datos.ajustes = viejo.ajustes || {};
    return datos;
  }

  function escribir(datos) {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); }
    catch (e) { /* modo privado o cuota llena: la app sigue funcionando */ }
  }

  function avisar() { oyentes.forEach(function (f) { try { f(); } catch (e) {} }); }

  // ───────────────────────── lectura ─────────────────────────

  function semillas() {
    return (root.MONOLOGUES || []).map(function (m) {
      return { id: m.id, title: m.title, author: m.author || '', text: m.text, cuando: 0, borrado: 0 };
    });
  }

  // Mientras no haya nada guardado, la biblioteca son los .txt del repo: así
  // la app arranca con contenido aunque sea la primera vez o no haya red.
  function monologos() {
    var datos = leer();
    var ids = Object.keys(datos.monologos);
    var lista = ids.length
      ? ids.map(function (id) { return datos.monologos[id]; })
      : semillas();
    return lista
      .filter(function (m) { return !m.borrado; })
      .sort(function (a, b) { return a.title.localeCompare(b.title); });
  }

  // ───────────────────────── escritura ─────────────────────────

  function guardar(monologo) {
    var datos = leer();
    // Al guardar el primero hay que fijar las semillas, o desaparecerían.
    if (!Object.keys(datos.monologos).length) {
      semillas().forEach(function (s) { datos.monologos[s.id] = s; });
    }
    datos.monologos[monologo.id] = {
      id: monologo.id,
      title: monologo.title,
      author: monologo.author || '',
      text: monologo.text,
      cuando: Date.now(),
      borrado: 0
    };
    escribir(datos);
    empujar();
  }

  function borrar(id) {
    var datos = leer();
    if (!Object.keys(datos.monologos).length) {
      semillas().forEach(function (s) { datos.monologos[s.id] = s; });
    }
    if (datos.monologos[id]) {
      datos.monologos[id].borrado = 1;
      datos.monologos[id].cuando = Date.now();
    }
    delete datos.progreso[id];
    escribir(datos);
    empujar();
  }

  function nivel(idMonologo, trozo) {
    var p = leer().progreso[idMonologo] || {};
    var e = p[root.Texto.limpiar(trozo)];
    return e ? e.nivel : 0;
  }

  function ponerNivel(idMonologo, trozo, valor) {
    var datos = leer();
    var p = datos.progreso[idMonologo] || (datos.progreso[idMonologo] = {});
    p[root.Texto.limpiar(trozo)] = { nivel: valor, cuando: Date.now() };
    escribir(datos);
    empujar();
  }

  function olvidar(idMonologo) {
    var datos = leer();
    var p = datos.progreso[idMonologo] || {};
    var cuando = Date.now();
    // Se ponen a cero en vez de borrarse, para que el cero viaje al otro aparato.
    Object.keys(p).forEach(function (t) { p[t] = { nivel: 0, cuando: cuando }; });
    escribir(datos);
    empujar();
  }

  function ajuste(clave, valor) {
    var datos = leer();
    if (arguments.length === 1) return datos.ajustes[clave];
    datos.ajustes[clave] = valor;
    escribir(datos);
    return valor;
  }

  // ───────────────────────── sincronización ─────────────────────────

  function frase(valor) {
    var datos = leer();
    if (arguments.length === 0) return datos.frase || '';
    datos.frase = valor || '';
    datos.sincronizado = 0;   // frase nueva: toca volver a bajarlo todo
    escribir(datos);
    return datos.frase;
  }

  function estado() {
    var datos = leer();
    return {
      frase: !!datos.frase,
      sincronizado: datos.sincronizado || 0,
      sincronizando: sincronizando,
      error: ultimoError
    };
  }

  function pedir(ruta, opciones) {
    var datos = leer();
    opciones = opciones || {};
    opciones.headers = Object.assign({ 'X-Frase': datos.frase }, opciones.headers || {});
    return fetch(SERVIDOR + ruta, opciones).then(function (r) {
      return r.json().then(function (cuerpo) {
        if (!r.ok) throw new Error(cuerpo && cuerpo.error ? cuerpo.error : 'error ' + r.status);
        return cuerpo;
      });
    });
  }

  var pendiente = null;
  function empujar() {
    if (!leer().frase) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(function () { sincronizar(); }, 1200);
  }

  function sincronizar() {
    var datos = leer();
    if (!datos.frase || sincronizando) return Promise.resolve(false);
    sincronizando = true;
    ultimoError = '';
    avisar();

    var desde = datos.sincronizado || 0;

    return pedir('/todo').then(function (remoto) {
      var d = leer();

      // 1. lo de fuera entra si es más reciente que lo de aquí
      (remoto.monologos || []).forEach(function (m) {
        var mio = d.monologos[m.id];
        if (!mio || m.cuando > mio.cuando) {
          d.monologos[m.id] = {
            id: m.id, title: m.titulo, author: m.autor || '', text: m.texto,
            cuando: m.cuando, borrado: m.borrado ? 1 : 0
          };
        }
      });
      (remoto.progreso || []).forEach(function (p) {
        var porMono = d.progreso[p.monologo] || (d.progreso[p.monologo] = {});
        var mio = porMono[p.trozo];
        if (!mio || p.cuando > mio.cuando) porMono[p.trozo] = { nivel: p.nivel, cuando: p.cuando };
      });
      escribir(d);

      // 2. lo de aquí sube si ha cambiado desde la última vez
      var subirMonologos = Object.keys(d.monologos)
        .map(function (id) { return d.monologos[id]; })
        .filter(function (m) { return m.cuando > desde; });

      // Si el servidor está vacío, se siembra con los .txt del repo.
      if (!(remoto.monologos || []).length && !subirMonologos.length) {
        subirMonologos = semillas().map(function (s) {
          return Object.assign({}, s, { cuando: Date.now() });
        });
        subirMonologos.forEach(function (s) { d.monologos[s.id] = s; });
        escribir(d);
      }

      var cambios = [];
      Object.keys(d.progreso).forEach(function (idMono) {
        var p = d.progreso[idMono];
        Object.keys(p).forEach(function (trozo) {
          if (p[trozo].cuando > desde) {
            cambios.push({ monologo: idMono, trozo: trozo, nivel: p[trozo].nivel, cuando: p[trozo].cuando });
          }
        });
      });

      var tareas = subirMonologos.map(function (m) {
        if (m.borrado) {
          return pedir('/monologo?id=' + encodeURIComponent(m.id), { method: 'DELETE' });
        }
        return pedir('/monologo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: m.id, titulo: m.title, autor: m.author, texto: m.text, cuando: m.cuando })
        });
      });

      if (cambios.length) {
        tareas.push(pedir('/progreso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cambios: cambios })
        }));
      }

      return Promise.all(tareas).then(function () {
        var f = leer();
        f.sincronizado = remoto.cuando || Date.now();
        escribir(f);
        return true;
      });
    }).catch(function (e) {
      ultimoError = String(e && e.message || e);
      return false;
    }).then(function (bien) {
      sincronizando = false;
      avisar();
      return bien;
    });
  }

  root.Almacen = {
    SERVIDOR: SERVIDOR,
    monologos: monologos,
    guardar: guardar,
    borrar: borrar,
    nivel: nivel,
    ponerNivel: ponerNivel,
    olvidar: olvidar,
    ajuste: ajuste,
    frase: frase,
    estado: estado,
    sincronizar: sincronizar,
    alCambiar: function (f) { oyentes.push(f); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
