/* =========================================================
   App.config.supabase — credenciales del proyecto Supabase
   -----------------------------------------------------------
   1. Copia este archivo como "supabaseConfig.js" (mismo folder).
   2. Ve a https://supabase.com → crea una cuenta gratis (sin
      tarjeta) → "New project" → elige nombre, contraseña de la
      base de datos y una región cercana. Espera ~2 minutos a que
      se aprovisione.
   3. Ve a Project Settings → API. Copia:
        - "Project URL"          → url
        - "anon public" API key  → anonKey
   4. Ve a SQL Editor → New query → pega TODO el contenido de
      supabase/schema.sql (en la raíz del proyecto) → Run.
      Eso crea la tabla y la función que la app necesita, y
      habilita la sincronización en tiempo real.

   Si dejas los valores TU_* tal cual, la app detecta que no hay
   config real y sigue funcionando con localStorage (modo local),
   exactamente como en la Fase 1 — no rompe nada mientras tanto.
   ========================================================= */
(function (App) {
  'use strict';

  App.config = App.config || {};
  App.config.supabase = {
    url: 'https://TU_PROYECTO.supabase.co',
    anonKey: 'TU_ANON_KEY',
  };

})(window.App = window.App || {});
