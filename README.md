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

En la app: **añadir un texto**, pegar, **guardar**. Ya está — aparece al
instante y en tus demás aparatos en cuanto haya red.

Para que viaje entre el móvil y el ordenador hay que activar la
sincronización una vez en cada aparato: en la biblioteca, **activar
sincronización** y escribir la frase.

## Dónde vive cada cosa

La app es **local-first**: escribe y lee de `localStorage`, así que pinta al
instante y funciona sin red. La base de datos es sólo el puente entre aparatos.

```
escribes  →  localStorage  →  pantalla          (siempre, al instante)
                   ↓
             Worker + D1                        (cuando hay red)
```

Si el Worker no contesta o estás sin cobertura, la app funciona igual y ya se
pondrá al día. Cada registro lleva una marca de tiempo; al sincronizar gana el
más reciente, para que dos aparatos no se pisen. Los borrados son suaves: si se
quitara la fila, el otro aparato la volvería a subir.

Los `.txt` de `monologues/` se quedan como **semilla**: mientras no haya nada
guardado, la biblioteca son ellos. Así la app arranca con contenido la primera
vez y sin red. En cuanto guardas algo, manda lo guardado.

Como los textos ya no viven en git, hay un **bajar una copia** en la biblioteca.
Úsalo de vez en cuando.

### El Worker

```
worker/src/worker.js        cuatro rutas: /todo, /monologo, /progreso
worker/migrations/          dos tablas: monologos y progreso
```

Autenticación: una frase secreta en la cabecera `X-Frase`, guardada en el
`localStorage` de cada aparato y **nunca en el repo**. Un solo usuario y datos
que son textos publicados y niveles de memorización; montar OAuth sería
desproporcionado.

Para desplegarlo:

```
cd worker
wrangler deploy
wrangler secret put FRASE          # si alguna vez quieres cambiarla
```

## Los ficheros

```
index.html               la estructura, cuatro pantallas
style.css                sólo negro y blanco
texto.js                 trocear, normalizar, comparar  ← la lógica difícil
almacen.js               localStorage + sincronización, aislado del resto
app.js                   estado + una sola función que pinta

monologues/*.txt         la semilla del primer arranque
monologues.js            generado a partir de ellos     ← no tocar
herramientas/            .txt → monologues.js, y añadir uno por terminal
worker/                  el Worker y las migraciones de D1
```

Sin dependencias ni compilación en la app. Se abre haciendo doble clic en
`index.html`.

## Pruebas

```
node pruebas.js                          el troceado, la tolerancia, las iniciales
node herramientas/pruebas-construir.mjs  el paso de .txt a monologues.js
node pruebas-navegador.mjs               la app de punta a punta
FRASE=... node pruebas-sincro.mjs        dos aparatos contra el Worker de verdad
```

Las dos últimas arrancan Chrome sin ventana y usan la app de verdad. No hace
falta instalar nada. `pruebas-sincro.mjs` **escribe en la base de datos real**:
vacíala antes si tienes algo que perder.

```
wrangler d1 execute memoria --remote --command "delete from monologos; delete from progreso;"
```
