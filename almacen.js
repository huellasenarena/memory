// Único punto de contacto con el almacenamiento.
// Hoy: localStorage (progreso por aparato). Si algún día quieres que el
// progreso viaje entre el móvil y el ordenador, sólo hay que reescribir
// estas funciones contra un servidor; el resto de la app no se entera.

(function (root) {
  'use strict';

  var CLAVE = 'memoria.v1';

  function leer() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      var datos = crudo ? JSON.parse(crudo) : null;
      if (!datos || typeof datos !== 'object') throw 0;
      datos.progreso = datos.progreso || {};
      datos.propios = datos.propios || [];
      datos.ajustes = datos.ajustes || {};
      return datos;
    } catch (e) {
      return { progreso: {}, propios: [], ajustes: {} };
    }
  }

  function escribir(datos) {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); }
    catch (e) { /* modo privado, cuota llena: la app sigue funcionando */ }
  }

  var Almacen = {
    // Textos del repo + los guardados en este aparato.
    monologos: function () {
      var deRepo = (root.MONOLOGUES || []).map(function (m) {
        return { id: m.id, title: m.title, author: m.author || '', text: m.text, propio: false };
      });
      var propios = leer().propios.map(function (m) {
        return { id: m.id, title: m.title, author: m.author || '', text: m.text, propio: true };
      });
      return deRepo.concat(propios);
    },

    // El nivel de cada trozo va indexado por su texto ya normalizado, no por
    // su posición: así cambiar el tamaño de los trozos no borra lo aprendido.
    nivel: function (idMonologo, trozo) {
      var p = leer().progreso[idMonologo] || {};
      return p[root.Texto.limpiar(trozo)] || 0;
    },

    ponerNivel: function (idMonologo, trozo, nivel) {
      var datos = leer();
      var p = datos.progreso[idMonologo] || (datos.progreso[idMonologo] = {});
      p[root.Texto.limpiar(trozo)] = nivel;
      escribir(datos);
    },

    olvidar: function (idMonologo) {
      var datos = leer();
      delete datos.progreso[idMonologo];
      escribir(datos);
    },

    ajuste: function (clave, valor) {
      var datos = leer();
      if (arguments.length === 1) return datos.ajustes[clave];
      datos.ajustes[clave] = valor;
      escribir(datos);
      return valor;
    },

    guardarPropio: function (monologo) {
      var datos = leer();
      datos.propios = datos.propios.filter(function (m) { return m.id !== monologo.id; });
      datos.propios.push(monologo);
      escribir(datos);
    },

    borrarPropio: function (id) {
      var datos = leer();
      datos.propios = datos.propios.filter(function (m) { return m.id !== id; });
      delete datos.progreso[id];
      escribir(datos);
    }
  };

  root.Almacen = Almacen;
})(typeof window !== 'undefined' ? window : globalThis);
