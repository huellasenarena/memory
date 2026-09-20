// memoria — memorizar monólogos escribiéndolos.
//
// En vanilla el peligro es que la pantalla deje de corresponder al estado.
// Por eso aquí sólo hay UN sitio que toca el DOM (`pintar`) y UNA forma de
// cambiar el estado (`cambiar`), que repinta siempre. Ninguna otra función
// escribe en la pantalla.

(function () {
  'use strict';

  var TAMANOS = [8, 11, 15];
  var REPO = 'huellasenarena/memory';
  var RAMA = 'main';
  var TOPE_URL = 6000;   // por encima de esto GitHub rechaza la URL: bajamos el fichero
  var $ = function (id) { return document.getElementById(id); };

  var estado = {
    vista: 'biblioteca',
    monologo: null,
    trozos: [],
    indice: 0,
    paso: 1,             // 1 copiar · 2 iniciales · 3 en blanco
    maximo: Number(Almacen.ajuste('maximo')) || 11,
    veredicto: null,     // {palabras, aciertos, total} mientras se muestra el fallo
    completo: false,
    enteroResultado: null,
    aviso: ''
  };

  function cambiar(fn) { fn(estado); pintar(); }

  // ─────────────────────────── lógica ───────────────────────────

  function recortar() {
    estado.trozos = estado.monologo ? Texto.trocear(estado.monologo.text, estado.maximo) : [];
  }

  function nivelDe(i) { return Almacen.nivel(estado.monologo.id, estado.trozos[i]); }

  function dominados() {
    var n = 0;
    for (var i = 0; i < estado.trozos.length; i++) if (nivelDe(i) >= 3) n++;
    return n;
  }

  // Primer trozo sin dominar a partir de `desde`, dando la vuelta si hace falta.
  function siguientePendiente(desde) {
    var n = estado.trozos.length;
    for (var k = 0; k < n; k++) {
      var i = (desde + k) % n;
      if (nivelDe(i) < 3) return i;
    }
    return -1;
  }

  function situarse(desde) {
    var i = siguientePendiente(desde);
    if (i === -1) { estado.completo = true; return; }
    estado.completo = false;
    estado.indice = i;
    estado.paso = Math.min(3, nivelDe(i) + 1);
  }

  function abrir(monologo) {
    cambiar(function (e) {
      e.vista = 'ensayo';
      e.monologo = monologo;
      e.veredicto = null;
      e.aviso = '';
      recortar();
      situarse(0);
    });
    enfocar();
  }

  function responder(escrito) {
    var esperado = estado.trozos[estado.indice];
    var vacio = !Texto.limpiar(escrito);
    var res = Texto.palabrasMarcadas(esperado, escrito);

    if (!vacio && res.exacto) {
      Almacen.ponerNivel(estado.monologo.id, esperado, estado.paso);
      cambiar(function (e) {
        e.veredicto = null;
        if (e.paso < 3) e.paso++;
        else situarse(e.indice + 1);
      });
      return;
    }

    // Fallo (o petición de ver la respuesta con el campo vacío): se baja un
    // escalón y se enseña el texto con las palabras que faltaron marcadas.
    var nuevoNivel = Math.max(0, estado.paso - 1);
    Almacen.ponerNivel(estado.monologo.id, esperado, nuevoNivel);
    cambiar(function (e) {
      e.veredicto = { palabras: res.palabras, aciertos: res.aciertos, total: res.total, vacio: vacio };
      e.paso = Math.max(1, e.paso - 1);
    });
  }

  function continuar() {
    cambiar(function (e) { e.veredicto = null; });
    enfocar();
  }

  function enfocar() {
    var campo = estado.vista === 'entero' ? $('entrada-entero') : $('entrada');
    // En el móvil no abrimos el teclado solo; en el ordenador sí.
    if (!matchMedia('(hover: none)').matches) setTimeout(function () { campo.focus(); }, 0);
  }

  // ─────────────────────────── pintado ───────────────────────────

  function pintar() {
    document.body.dataset.vista = estado.vista;
    if (estado.vista === 'biblioteca') pintarBiblioteca();
    if (estado.vista === 'ensayo') pintarEnsayo();
    if (estado.vista === 'entero') pintarEntero();
  }

  function pintarBiblioteca() {
    var lista = $('lista');
    lista.textContent = '';
    Almacen.monologos().forEach(function (m) {
      var trozos = Texto.trocear(m.text, estado.maximo);
      var hechos = trozos.filter(function (t) { return Almacen.nivel(m.id, t) >= 3; }).length;

      var li = document.createElement('li');

      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'titulo';
      boton.textContent = m.title;
      boton.onclick = function () { abrir(m); };
      li.appendChild(boton);

      var meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = [
        m.author,
        Texto.contarPalabras(m.text) + ' palabras',
        hechos + ' de ' + trozos.length + ' trozos'
      ].filter(Boolean).join(' · ');
      li.appendChild(meta);

      var barra = document.createElement('div');
      barra.className = 'mini';
      var relleno = document.createElement('i');
      relleno.style.width = (trozos.length ? (hechos / trozos.length) * 100 : 0) + '%';
      barra.appendChild(relleno);
      li.appendChild(barra);

      var acciones = document.createElement('p');
      acciones.className = 'meta acciones-linea';
      acciones.appendChild(enlace('entero', function () {
        cambiar(function (e) {
          e.vista = 'entero'; e.monologo = m; e.enteroResultado = null;
        });
        $('entrada-entero').value = '';
        enfocar();
      }));
      if (hechos) {
        acciones.appendChild(enlace('empezar de cero', function () {
          Almacen.olvidar(m.id);
          cambiar(function () {});
        }));
      }
      if (m.propio) {
        acciones.appendChild(enlace('quitar', function () {
          Almacen.borrarPropio(m.id);
          cambiar(function () {});
        }));
      }
      li.appendChild(acciones);
      lista.appendChild(li);
    });
  }

  function enlace(texto, alPulsar) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'enlace';
    b.textContent = texto;
    b.onclick = alPulsar;
    return b;
  }

  function pintarEnsayo() {
    var m = estado.monologo;
    $('titulo').textContent = m.title;

    var total = estado.trozos.length;
    var hechos = dominados();
    $('contador').textContent = estado.completo
      ? total + ' / ' + total
      : (estado.indice + 1) + ' / ' + total;
    $('barra').firstElementChild.style.width = (total ? (hechos / total) * 100 : 0) + '%';

    $('rastro').textContent = estado.indice > 0 && !estado.completo
      ? estado.trozos[estado.indice - 1] : '';

    var apunte = $('apunte');
    var veredicto = $('veredicto');
    var entrada = $('entrada');
    apunte.textContent = '';
    apunte.className = '';
    veredicto.textContent = '';
    veredicto.className = '';

    if (estado.completo) {
      apunte.className = 'final';
      apunte.textContent = 'Los ' + total + ' trozos están dominados.';
      veredicto.className = 'meta';
      veredicto.appendChild(enlace('escribirlo entero', function () {
        cambiar(function (e) { e.vista = 'entero'; e.enteroResultado = null; });
        $('entrada-entero').value = '';
        enfocar();
      }));
      entrada.disabled = true;
      entrada.value = '';
      $('pasos').textContent = '';
      $('pista').textContent = '';
      pintarTamanos();
      return;
    }

    entrada.disabled = false;
    var trozo = estado.trozos[estado.indice];

    if (estado.veredicto) {
      // Se enseña el texto real con lo que faltó marcado.
      apunte.className = 'corregido';
      estado.veredicto.palabras.forEach(function (p, i) {
        if (i) apunte.appendChild(document.createTextNode(' '));
        var s = document.createElement('span');
        s.textContent = p.palabra;
        if (!p.neutra && !p.ok) s.className = 'fallo';
        apunte.appendChild(s);
      });
      veredicto.className = 'meta';
      veredicto.textContent = estado.veredicto.vacio
        ? 'ahí lo tienes'
        : estado.veredicto.aciertos + ' de ' + estado.veredicto.total + ' palabras';
    } else if (estado.paso === 1) {
      apunte.className = 'texto';
      apunte.textContent = trozo;
    } else if (estado.paso === 2) {
      apunte.className = 'texto iniciales';
      apunte.textContent = Texto.iniciales(trozo);
    } else {
      apunte.className = 'texto puntos';
      apunte.textContent = Texto.puntos(trozo);
    }

    var pasos = $('pasos');
    pasos.textContent = '';
    [1, 2, 3].forEach(function (n) {
      var s = document.createElement('i');
      s.className = n <= estado.paso ? 'lleno' : '';
      pasos.appendChild(s);
    });

    $('pista').textContent = estado.veredicto
      ? 'enter para seguir'
      : 'enter valida · enter en blanco te lo enseña';

    pintarTamanos();
    ajustarAlto(entrada);
  }

  function pintarTamanos() {
    var caja = $('trozos');
    caja.textContent = 'trozos ';
    TAMANOS.forEach(function (n, i) {
      if (i) caja.appendChild(document.createTextNode(' · '));
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'enlace' + (n === estado.maximo ? ' activo' : '');
      b.textContent = String(n);
      b.onclick = function () {
        Almacen.ajuste('maximo', n);
        cambiar(function (e) {
          e.maximo = n;
          e.veredicto = null;
          recortar();
          situarse(0);
        });
        enfocar();
      };
      caja.appendChild(b);
    });
  }

  function pintarEntero() {
    var m = estado.monologo;
    $('titulo-entero').textContent = m.title;
    $('cuenta-entero').textContent = Texto.contarPalabras(m.text) + ' palabras';

    var salida = $('resultado-entero');
    salida.textContent = '';
    salida.className = '';
    $('rehacer-entero').hidden = !estado.enteroResultado;
    $('corregir-entero').hidden = !!estado.enteroResultado;
    $('entrada-entero').hidden = !!estado.enteroResultado;

    if (!estado.enteroResultado) return;

    salida.className = 'corregido entero';
    var cuenta = document.createElement('p');
    cuenta.className = 'meta';
    cuenta.textContent = estado.enteroResultado.aciertos + ' de ' +
                         estado.enteroResultado.total + ' palabras';
    salida.appendChild(cuenta);

    var cuerpo = document.createElement('p');
    estado.enteroResultado.palabras.forEach(function (p, i) {
      if (i) cuerpo.appendChild(document.createTextNode(' '));
      var s = document.createElement('span');
      s.textContent = p.palabra;
      if (!p.neutra && !p.ok) s.className = 'fallo';
      cuerpo.appendChild(s);
    });
    salida.appendChild(cuerpo);
  }

  function ajustarAlto(campo) {
    campo.style.height = 'auto';
    campo.style.height = campo.scrollHeight + 'px';
  }

  // ─────────────────────────── sucesos ───────────────────────────

  document.querySelectorAll('[data-ir]').forEach(function (b) {
    b.onclick = function () {
      cambiar(function (e) { e.vista = b.dataset.ir; e.aviso = ''; });
    };
  });

  $('entrada').addEventListener('input', function () { ajustarAlto(this); });

  $('entrada').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    ev.preventDefault();
    if (estado.veredicto) { continuar(); return; }
    var escrito = this.value;
    this.value = '';
    ajustarAlto(this);
    responder(escrito);
    enfocar();
  });

  $('corregir-entero').onclick = function () {
    var escrito = $('entrada-entero').value;
    cambiar(function (e) {
      e.enteroResultado = Texto.palabrasMarcadas(e.monologo.text, escrito);
    });
  };

  $('rehacer-entero').onclick = function () {
    cambiar(function (e) { e.enteroResultado = null; });
    $('entrada-entero').value = '';
    enfocar();
  };

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && estado.vista !== 'biblioteca') {
      cambiar(function (e) { e.vista = 'biblioteca'; });
    }
  });

  // ─────────────────────────── añadir ───────────────────────────

  function apodo(titulo) {
    var base = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'texto';
    var usados = Almacen.monologos().map(function (m) { return m.id; });
    var id = base, n = 2;
    while (usados.indexOf(id) !== -1) id = base + '-' + n++;
    return id;
  }

  function recogerNuevo() {
    var titulo = $('nuevo-titulo').value.trim();
    var texto = $('nuevo-texto').value.trim();
    if (!titulo || !texto) return null;
    return { id: apodo(titulo), title: titulo, author: $('nuevo-autor').value.trim(), text: texto };
  }

  $('guardar-nuevo').onclick = function () {
    var m = recogerNuevo();
    if (!m) { this.textContent = 'falta el título o el texto'; return; }
    Almacen.guardarPropio(m);
    $('nuevo-titulo').value = $('nuevo-autor').value = $('nuevo-texto').value = '';
    this.textContent = 'sólo en este aparato';
    cambiar(function (e) { e.vista = 'biblioteca'; });
  };

  // El fichero tal cual va a vivir en monologues/: título, autor, texto.
  function comoFichero(m) {
    return m.title + '\n' + m.author + '\n\n' + m.text + '\n';
  }

  function bajarFichero(nombre, contenido) {
    var url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  $('subir-nuevo').onclick = function () {
    var m = recogerNuevo();
    if (!m) { this.textContent = 'falta el título o el texto'; return; }

    var ruta = 'monologues/' + m.id + '.txt';
    var contenido = comoFichero(m);
    var url = 'https://github.com/' + REPO + '/new/' + RAMA +
              '?filename=' + encodeURIComponent(ruta) +
              '&value=' + encodeURIComponent(contenido);

    // El editor nuevo de GitHub ya no rellena el fichero desde la URL, así
    // que abrirlo sólo daba un error. Hasta que la app sepa guardar sola,
    // bajamos el .txt, que sí funciona.
    void url;
    bajarFichero(m.id + '.txt', contenido);
    $('nota-nuevo').textContent = 'Bajado ' + m.id + '.txt — déjalo en monologues/ y haz push.';
  };

  pintar();
})();
