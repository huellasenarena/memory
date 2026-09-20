# memoria — contexto del proyecto

App de una página para **memorizar monólogos escribiéndolos**. El usuario es
actor. **Habla en español** (a veces en francés).

- Repo: `~/Desktop/memory/`, remoto `huellasenarena/memory`, público
- URL: https://huellasenarena.github.io/memory/ — Pages sirve `main` desde la raíz
- **Sin dependencias y sin compilación.** Vanilla a propósito: se decidió
  después de comparar con Vue por CDN y con React. No meter un framework, ni
  npm, ni un paso de build sin hablarlo.

## Decisiones ya tomadas (no rehacerlas sin preguntar)

- **Troceado**: por puntuación, con recorte de lo largo por conectores y fusión
  de lo corto. El tamaño máximo lo elige el usuario entre 8 / 11 / 15.
- **Método**: tres pasos por trozo — texto visible → iniciales → en blanco.
  Acierto sube un paso, fallo baja uno. Dominado = escrito en blanco.
- **Corrección**: blanda con mayúsculas, apóstrofos, guiones y puntuación;
  **dura con singular/plural y con los acentos** (en español distinguen).
- **Estilo**: sólo negro y blanco, sin color ni en los errores (se tachan).
  Modo oscuro = el mismo blanco y negro invertido. Todo por teclado.
- **Almacenamiento**: textos en `monologues/*.txt` (git, en todos los aparatos),
  progreso en localStorage (por aparato), indexado por el texto normalizado del
  trozo y no por su posición. Se valoró un backend Cloudflare + D1 como el de
  `vocab-app` y se aplazó; `almacen.js` está aislado para poder cambiarlo.

## Reglas de la casa

- En vanilla el riesgo es que la pantalla deje de corresponder al estado. Por
  eso **sólo `pintar()` toca el DOM** y **sólo `cambiar()` modifica el estado**,
  y siempre repinta. Mantener esa disciplina.
- `texto.js` es la única parte con lógica delicada. Antes de cada commit:
  **`node pruebas.js`** (el motor), **`node herramientas/pruebas-construir.mjs`**
  (el paso de .txt a monologues.js) y **`node pruebas-navegador.mjs`** (la app
  entera en Chrome headless, sin instalar nada).
- Una sola cuenta de palabras en toda la app: `Texto.contarPalabras`. No usar
  `split(/\s+/).length`, que cuenta las rayas sueltas y descuadra con la
  corrección.
- **`monologues.js` es generado.** La fuente son los `.txt` de `monologues/`.
  Editarlo a mano se pierde en el siguiente push, que lo regenera con la
  Action `biblioteca`. Para añadir un texto: crear el `.txt`, nada más.
