// Motor de texto: trocear, normalizar, comparar.
// Sin dependencias. Se prueba con `node pruebas.js`.

(function (root) {
  'use strict';

  // Palabras por las que se puede partir un trozo demasiado largo que no
  // tiene puntuación interna. Inglés, español y francés.
  var CONECTORES = new Set((
    'and or but because that which who when while since if so just like until then than as ' +
    'y e o u pero porque que cual cuando mientras si como hasta entonces aunque pues ' +
    'et ou mais parce qui quand pendant puisque comme alors donc'
  ).split(' '));

  var FIN_FRASE = /[,.;:!?…][»”’"')\]]*$/;
  var SOLO_RAYA = /^[–—-]+$/;

  // Trocea el texto en unidades de respiración.
  // 1. corta en la puntuación
  // 2. vuelve a cortar lo que pase de `maximo` palabras, por un conector
  // 3. funde los fragmentos de menos de `minimo` palabras con el anterior
  function trocear(texto, maximo) {
    var palabras = String(texto).trim().split(/\s+/).filter(Boolean);
    if (!palabras.length) return [];
    var minimo = Math.max(2, Math.round(maximo / 3));

    var cortes = new Set();
    palabras.forEach(function (p, i) {
      if (FIN_FRASE.test(p)) cortes.add(i);
      else if (SOLO_RAYA.test(p) && i > 0) cortes.add(i - 1);
    });
    cortes.add(palabras.length - 1);

    var crudos = [], inicio = 0;
    for (var i = 0; i < palabras.length; i++) {
      if (cortes.has(i)) { crudos.push(palabras.slice(inicio, i + 1)); inicio = i + 1; }
    }

    var partidos = [];
    crudos.forEach(function (u) {
      while (u.length > maximo) {
        // Si lo que queda cabe en dos trozos, buscamos el corte mas
        // equilibrado; si no, llenamos un trozo y seguimos.
        var cabeEnDos = u.length <= 2 * maximo;
        var bajo = cabeEnDos ? Math.max(minimo, u.length - maximo) : minimo;
        var alto = Math.min(maximo, u.length - minimo);
        var objetivo = cabeEnDos ? u.length / 2 : alto;

        var opciones = [];
        for (var i = bajo; i <= alto; i++) {
          if (CONECTORES.has(limpiar(u[i]))) opciones.push(i);
        }

        var corte;
        if (opciones.length) {
          corte = opciones.reduce(function (a, b) {
            return Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a;
          });
        } else {
          corte = cabeEnDos ? Math.ceil(u.length / 2) : maximo;
        }

        partidos.push(u.slice(0, corte));
        u = u.slice(corte);
      }
      partidos.push(u);
    });

    var fundidos = [];
    partidos.forEach(function (u) {
      var previo = fundidos[fundidos.length - 1];
      if (previo && u.length < minimo && previo.length + u.length <= maximo) {
        fundidos[fundidos.length - 1] = previo.concat(u);
      } else {
        fundidos.push(u);
      }
    });

    return fundidos.map(function (u) { return u.join(' '); });
  }

  // Quita puntuación, apóstrofos y mayúsculas. NO toca los acentos ni los
  // plurales: "ruins" y "ruin" siguen siendo dos palabras distintas.
  function limpiar(s) {
    return String(s)
      .toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'")
      .replace(/[“”«»]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/-/g, ' ')
      .replace(/['"¿¡.,;:!?…()\[\]{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function enPalabras(s) {
    return limpiar(s).split(' ').filter(Boolean);
  }

  // Iniciales: "The wind's blown it away." -> "T w's b i a."
  function iniciales(texto) {
    return String(texto).split(/\s+/).map(function (palabra) {
      // Se conserva la primera letra de cada tramo: "wind's" -> "w's".
      var salida = '', enTramo = false;
      for (var c of palabra) {
        if (/[\p{L}\p{N}]/u.test(c)) {
          if (!enTramo) { salida += c; enTramo = true; }
        } else {
          salida += c;
          enTramo = false;
        }
      }
      return salida;
    }).join(' ');
  }

  // Un punto por palabra, para no dejar la pantalla del todo vacía.
  function puntos(texto) {
    return String(texto).trim().split(/\s+/).map(function () { return '·'; }).join(' ');
  }

  // Marca, palabra por palabra del texto esperado, cuáles aparecen en lo
  // escrito. Usa subsecuencia común más larga para que una palabra que falta
  // no desplace todo lo que viene detrás.
  function comparar(esperado, escrito) {
    var a = enPalabras(esperado), b = enPalabras(escrito);
    var n = a.length, m = b.length;
    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var marcas = new Array(n).fill(false);
    var i2 = 0, j2 = 0;
    while (i2 < n && j2 < m) {
      if (a[i2] === b[j2]) { marcas[i2] = true; i2++; j2++; }
      else if (dp[i2 + 1][j2] >= dp[i2][j2 + 1]) i2++;
      else j2++;
    }
    var aciertos = marcas.filter(Boolean).length;
    return { marcas: marcas, aciertos: aciertos, total: n, exacto: aciertos === n && n === m };
  }

  // Devuelve las palabras originales (con su puntuación) junto a su marca,
  // para poder pintar el resultado sin perder el texto real.
  function palabrasMarcadas(esperado, escrito) {
    var originales = String(esperado).trim().split(/\s+/);
    var res = comparar(esperado, escrito);
    // enPalabras puede descartar un token que sea sólo puntuación (una raya
    // suelta), así que recorremos en paralelo saltándonoslos.
    var salida = [], k = 0;
    originales.forEach(function (p) {
      var trozos = enPalabras(p).length;
      if (!trozos) { salida.push({ palabra: p, ok: true, neutra: true }); return; }
      var ok = true;
      for (var i = 0; i < trozos; i++) { if (!res.marcas[k + i]) ok = false; }
      k += trozos;
      salida.push({ palabra: p, ok: ok, neutra: false });
    });
    // Se cuenta sobre las palabras tal y como se ven, no sobre las
    // normalizadas: si no, "so-called" valdria por dos y una raya suelta por
    // ninguna, y el total no cuadraria con el que anuncia la portada.
    var reales = salida.filter(function (p) { return !p.neutra; });
    return {
      palabras: salida,
      aciertos: reales.filter(function (p) { return p.ok; }).length,
      total: reales.length,
      exacto: res.exacto
    };
  }

  // El numero de palabras que la app anuncia. Misma cuenta en todas partes.
  function contarPalabras(texto) {
    return String(texto).trim().split(/\s+/).filter(function (p) {
      return limpiar(p);
    }).length;
  }

  root.Texto = {
    trocear: trocear,
    limpiar: limpiar,
    enPalabras: enPalabras,
    iniciales: iniciales,
    contarPalabras: contarPalabras,
    puntos: puntos,
    comparar: comparar,
    palabrasMarcadas: palabrasMarcadas
  };
})(typeof window !== 'undefined' ? window : globalThis);
