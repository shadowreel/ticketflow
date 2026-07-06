-- =============================================================
--  TicketFlow · Vistas legibles para el Table Editor de Supabase
-- =============================================================
--  La tabla "ticketflow_data" guarda TODO como JSON genérico
--  (columna "record") para poder soportar cualquier colección
--  sin rediseñar tablas cada vez. Es ideal para el código, pero
--  incómodo de leer a simple vista en el dashboard.
--
--  Este script crea 5 VISTAS (tablas de solo lectura, no ocupan
--  espacio ni duplican datos: se calculan al vuelo) con columnas
--  normales en español en vez de JSON crudo. Aparecen solas en
--  Table Editor, en la sección "Views".
--
--  Uso: Supabase → SQL Editor → New query → pega todo → Run.
--  Es 100% seguro volver a ejecutarlo cuantas veces quieras.
-- =============================================================


-- -------------------------------------------------------------
-- 1) v_administradores — cuenta del administrador del sistema
-- -------------------------------------------------------------
drop view if exists v_administradores;
create view v_administradores as
select
  id                                                     as id,
  record ->> 'username'                                  as usuario,
  record ->> 'name'                                      as nombre,
  record ->> 'email'                                     as correo,
  (record ->> 'mustChangePassword')::boolean             as debe_cambiar_password,
  to_timestamp((record ->> 'createdAt')::bigint / 1000)  as creado
from ticketflow_data
where collection = 'admin'
order by nombre;


-- -------------------------------------------------------------
-- 2) v_tecnicos — personal técnico dado de alta por el admin
-- -------------------------------------------------------------
drop view if exists v_tecnicos;
create view v_tecnicos as
select
  id                                                     as id,
  record ->> 'name'                                      as nombre,
  record ->> 'username'                                  as usuario,
  record ->> 'email'                                     as correo,
  record ->> 'position'                                  as puesto,
  (record ->> 'active')::boolean                         as activo,
  (record ->> 'mustChangePassword')::boolean             as debe_cambiar_password,
  to_timestamp((record ->> 'createdAt')::bigint / 1000)  as creado
from ticketflow_data
where collection = 'technicians'
order by nombre;


-- -------------------------------------------------------------
-- 3) v_usuarios — usuarios finales autorregistrados
-- -------------------------------------------------------------
drop view if exists v_usuarios;
create view v_usuarios as
select
  id                                                     as id,
  record ->> 'name'                                      as nombre,
  record ->> 'email'                                     as correo,
  to_timestamp((record ->> 'createdAt')::bigint / 1000)  as creado
from ticketflow_data
where collection = 'users'
order by creado desc;


-- -------------------------------------------------------------
-- 4) v_incidencias — ciclo de vida completo de cada ticket
-- -------------------------------------------------------------
drop view if exists v_incidencias;
create view v_incidencias as
select
  id                                                                    as id,
  record ->> 'folio'                                                    as folio,
  record ->> 'title'                                                    as titulo,
  record ->> 'category'                                                 as categoria,
  record ->> 'priority'                                                 as prioridad,
  record ->> 'status'                                                   as estado,
  record -> 'reportedBy' ->> 'name'                                     as reportado_por,
  record -> 'assignedTo' ->> 'name'                                     as asignado_a,
  jsonb_array_length(coalesce(record -> 'attachments', '[]'::jsonb))    as num_adjuntos,
  to_timestamp((record ->> 'createdAt')::bigint / 1000)                 as creado
from ticketflow_data
where collection = 'incidents'
order by creado desc;


-- -------------------------------------------------------------
-- 5) v_notificaciones — avisos enviados a cada destinatario
-- -------------------------------------------------------------
drop view if exists v_notificaciones;
create view v_notificaciones as
select
  id                                                     as id,
  record ->> 'recipientId'                                as destinatario_id,
  record ->> 'type'                                       as tipo,
  record ->> 'title'                                      as titulo,
  record ->> 'message'                                    as mensaje,
  (record ->> 'read')::boolean                            as leida,
  to_timestamp((record ->> 'createdAt')::bigint / 1000)   as creado
from ticketflow_data
where collection = 'notifications'
order by creado desc;


-- =============================================================
--  Listo. Ve a Table Editor → sección "Views" (debajo de la
--  tabla ticketflow_data) para explorar cada una con columnas
--  normales, filtros y orden, igual que cualquier tabla.
-- =============================================================
