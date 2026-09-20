// Worker de "memoria": guarda los textos y el progreso, para que viajen entre
// el móvil y el ordenador.
//
// La app es local-first: escribe en su localStorage y pinta al instante, y
// esto de aquí es sólo el puente entre aparatos. Si el Worker no contesta, la
// app funciona igual y ya se pondrá al día.
//
// Autenticación: una frase secreta en la cabecera X-Frase. Un solo usuario,
// datos que son textos publicados y niveles de memorización; montar OAuth
// para esto sería desproporcionado.

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Frase',
  'Access-Control-Max-Age': '86400'
};

const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CABECERAS }
  });

// Comparación en tiempo constante, para no filtrar la frase carácter a carácter.
function igual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

const ahora = () => Date.now();

function limpiarTexto(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

export default {
  async fetch(peticion, env) {
    const url = new URL(peticion.url);
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    if (peticion.method === 'OPTIONS') return new Response(null, { status: 204, headers: CABECERAS });

    if (ruta === '/') return json({ ok: true, servicio: 'memoria' });

    if (!env.FRASE) return json({ error: 'el Worker no tiene frase configurada' }, 500);
    if (!igual(peticion.headers.get('X-Frase') || '', env.FRASE)) {
      return json({ error: 'frase incorrecta' }, 401);
    }

    try {
      if (ruta === '/todo' && peticion.method === 'GET') return await todo(env);
      if (ruta === '/monologo' && peticion.method === 'POST') return await guardarMonologo(peticion, env);
      if (ruta === '/monologo' && peticion.method === 'DELETE') return await borrarMonologo(url, env);
      if (ruta === '/progreso' && peticion.method === 'POST') return await guardarProgreso(peticion, env);
      return json({ error: 'ruta desconocida' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};

// Todo de una vez: son pocos datos y así la app sincroniza con una sola llamada.
async function todo(env) {
  const [monologos, progreso] = await Promise.all([
    env.DB.prepare(
      'select id, titulo, autor, texto, cuando, borrado from monologos order by titulo'
    ).all(),
    env.DB.prepare('select monologo, trozo, nivel, cuando from progreso').all()
  ]);
  return json({
    monologos: monologos.results || [],
    progreso: progreso.results || [],
    cuando: ahora()
  });
}

async function guardarMonologo(peticion, env) {
  const cuerpo = await peticion.json();
  const id = String(cuerpo.id || '').trim();
  const titulo = limpiarTexto(cuerpo.titulo);
  const texto = limpiarTexto(cuerpo.texto);
  const autor = limpiarTexto(cuerpo.autor);

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return json({ error: 'id no válido' }, 400);
  if (!titulo) return json({ error: 'falta el título' }, 400);
  if (!texto) return json({ error: 'falta el texto' }, 400);
  if (texto.length > 200000) return json({ error: 'texto demasiado largo' }, 400);

  const cuando = Number(cuerpo.cuando) || ahora();

  // Gana la escritura más reciente, para que dos aparatos no se pisen.
  await env.DB.prepare(`
    insert into monologos (id, titulo, autor, texto, cuando, borrado)
    values (?1, ?2, ?3, ?4, ?5, 0)
    on conflict(id) do update set
      titulo  = excluded.titulo,
      autor   = excluded.autor,
      texto   = excluded.texto,
      cuando  = excluded.cuando,
      borrado = 0
    where excluded.cuando >= monologos.cuando
  `).bind(id, titulo, autor, texto, cuando).run();

  return json({ ok: true, id, cuando });
}

async function borrarMonologo(url, env) {
  const id = String(url.searchParams.get('id') || '').trim();
  if (!id) return json({ error: 'falta el id' }, 400);
  // Borrado suave: si lo quitáramos de la tabla, el otro aparato lo volvería
  // a subir en la siguiente sincronización.
  await env.DB.prepare(
    'update monologos set borrado = 1, cuando = ?2 where id = ?1'
  ).bind(id, ahora()).run();
  await env.DB.prepare('delete from progreso where monologo = ?1').bind(id).run();
  return json({ ok: true, id });
}

async function guardarProgreso(peticion, env) {
  const cuerpo = await peticion.json();
  const cambios = Array.isArray(cuerpo.cambios) ? cuerpo.cambios : [];
  if (!cambios.length) return json({ ok: true, guardados: 0 });
  if (cambios.length > 5000) return json({ error: 'demasiados cambios de una vez' }, 400);

  const sentencia = env.DB.prepare(`
    insert into progreso (monologo, trozo, nivel, cuando)
    values (?1, ?2, ?3, ?4)
    on conflict(monologo, trozo) do update set
      nivel  = excluded.nivel,
      cuando = excluded.cuando
    where excluded.cuando >= progreso.cuando
  `);

  const lote = [];
  for (const c of cambios) {
    const monologo = String(c.monologo || '').trim();
    const trozo = String(c.trozo || '').trim();
    const nivel = Number(c.nivel);
    const cuando = Number(c.cuando) || ahora();
    if (!monologo || !trozo) continue;
    if (!(nivel >= 0 && nivel <= 3)) continue;
    lote.push(sentencia.bind(monologo, trozo, nivel, cuando));
  }

  if (lote.length) await env.DB.batch(lote);
  return json({ ok: true, guardados: lote.length });
}
