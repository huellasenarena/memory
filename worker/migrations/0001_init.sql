-- Los textos. Fuente de verdad desde que existe el Worker; los .txt del repo
-- se quedan como semilla para el primer arranque y para trabajar sin red.
create table if not exists monologos (
  id      text primary key,
  titulo  text not null,
  autor   text not null default '',
  texto   text not null,
  cuando  integer not null,          -- epoch ms de la última escritura
  borrado integer not null default 0 -- borrado suave: si no, volvería al sincronizar
);

-- El progreso, igual que en localStorage: el nivel de cada trozo, indexado por
-- el texto normalizado del trozo y no por su posición.
create table if not exists progreso (
  monologo text not null,
  trozo    text not null,
  nivel    integer not null,
  cuando   integer not null,
  primary key (monologo, trozo)
);

create index if not exists progreso_cuando on progreso (cuando);
create index if not exists monologos_cuando on monologos (cuando);
