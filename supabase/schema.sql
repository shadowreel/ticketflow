-- =========================================================
-- TicketFlow — esquema de Supabase
-- -----------------------------------------------------------
-- Copia y pega TODO este archivo en Supabase → SQL Editor →
-- "New query" → Run. Crea una única tabla genérica que guarda
-- cada colección de la app (incidents, users, technicians,
-- notifications, admin, meta) como JSON, imitando el modelo de
-- documentos que ya usa storageAdapter.js — así no hace falta
-- rediseñar tablas relacionales para cada entidad.
-- =========================================================

create table if not exists ticketflow_data (
  id text primary key,
  collection text not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists ticketflow_data_collection_idx on ticketflow_data (collection);

-- Necesario para que los eventos de eliminación en tiempo real incluyan la
-- fila completa (no solo el id), para poder identificar la colección afectada.
alter table ticketflow_data replica identity full;

-- Regla de acceso abierta para la demo (equivalente a "allow read, write: if true"
-- de Firestore). No usar así con datos sensibles en producción.
alter table ticketflow_data enable row level security;

drop policy if exists "demo_allow_all" on ticketflow_data;
create policy "demo_allow_all" on ticketflow_data for all using (true) with check (true);

-- Habilita las actualizaciones en tiempo real (multi-computadora) sobre esta tabla.
alter publication supabase_realtime add table ticketflow_data;

-- Incremento atómico para folios (INC-0001, INC-0002...) — evita folios
-- duplicados si dos administradores crean incidencias al mismo tiempo.
create or replace function ticketflow_next_sequence(seq_name text)
returns int
language plpgsql
as $$
declare
  current_val int;
  new_val int;
  rec jsonb;
begin
  select record into rec from ticketflow_data where collection = 'meta' and id = '00000000-0000-0000-0000-000000000001' for update;

  if rec is null then
    new_val := 1;
    insert into ticketflow_data (id, collection, record)
      values ('00000000-0000-0000-0000-000000000001', 'meta', jsonb_build_object(seq_name, new_val));
  else
    current_val := coalesce((rec ->> seq_name)::int, 0);
    new_val := current_val + 1;
    update ticketflow_data
      set record = rec || jsonb_build_object(seq_name, new_val), updated_at = now()
      where collection = 'meta' and id = '00000000-0000-0000-0000-000000000001';
  end if;

  return new_val;
end;
$$;
