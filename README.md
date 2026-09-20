# memoria

Memorizar monólogos escribiéndolos.

**https://huellasenarena.github.io/memory/**

## Cómo funciona

El texto se parte en **trozos de respiración**: se corta por la puntuación,
lo que queda demasiado largo se vuelve a cortar por un conector (*and*, *because*,
*que*, *mais*…) y los fragmentos sueltos se funden con el anterior. El resultado
son trozos de 2 a 11 palabras que caen donde de verdad respirarías.

Cada trozo se trabaja en **tres pasos**, cada uno con menos ayuda que el anterior:

```
1  The wind's blown it away.     lo copias
2  T w's b i a.                  lo reconstruyes   ← aquí se graba
3  · · · · ·                     de memoria
```

Aciertas y subes de paso. Fallas y bajas uno. Un trozo sólo queda dominado
cuando lo escribes con la página en blanco. Cuando lo están todos, puedes
escribir **el monólogo entero** de una sentada y ver qué palabras se fueron.

La corrección es blanda con lo que no se oye y dura con lo que sí: no mira
mayúsculas, apóstrofos ni puntuación, pero *ruin* y *ruins* son dos palabras
distintas.

## Atajos

| | |
|---|---|
| `enter` | validar |
| `enter` en blanco | enseñarme la respuesta (cuenta como fallo) |
| `esc` | volver a la biblioteca |

## Añadir un monólogo

Desde la app, **añadir un texto** → *guardar*. Eso lo deja en ese aparato.

Para tenerlo en todos, pulsa **copiar para el repo** y pega el bloque en
`monologues.js`; al hacer push aparece en el móvil y en el ordenador.

## Dónde vive cada cosa

- **Los textos** están en `monologues.js`, versionados por git. Van con el
  repo, así que están en todos los aparatos y no se pueden perder.
- **El progreso** vive en el `localStorage` de cada navegador, o sea que es de
  cada aparato. Va indexado por el *texto* de cada trozo, no por su posición:
  cambiar el tamaño de los trozos no borra lo aprendido.

Todo el almacenamiento pasa por `almacen.js`. Si algún día quieres que el
progreso viaje entre aparatos, se reescriben esas funciones contra un servidor
y el resto de la app no se entera.

## Los ficheros

```
index.html      la estructura, cuatro pantallas
style.css       sólo negro y blanco
texto.js        trocear, normalizar, comparar   ← la única parte con lógica difícil
almacen.js      localStorage, aislado
app.js          estado + una sola función que pinta
monologues.js   la biblioteca
pruebas.js      node pruebas.js
```

Sin dependencias, sin compilación. Se abre haciendo doble clic en `index.html`.
