/* =========================================================
   App.config.firebase — credenciales del proyecto Firebase
   -----------------------------------------------------------
   1. Copia este archivo como "firebaseConfig.js" (mismo folder).
   2. Ve a https://console.firebase.google.com → crea un proyecto
      gratuito → Compilación → Firestore Database → "Crear base
      de datos" en modo de prueba.
   3. Configuración del proyecto → "Tus apps" → ícono Web (</>)
      → registra la app → copia el objeto de configuración que
      te muestra y pégalo abajo, reemplazando los valores TU_*.
   4. Regla de Firestore para la demo (Firestore → Reglas):
        allow read, write: if true;
      (abierta a propósito para la demo; no usar así en producción)

   Si dejas los valores TU_* tal cual, la app detecta que no hay
   config real y sigue funcionando con localStorage (modo local),
   exactamente como en la Fase 1 — no rompe nada mientras tanto.
   ========================================================= */
(function (App) {
  'use strict';

  App.config = App.config || {};
  App.config.firebase = {
    apiKey: 'TU_API_KEY',
    authDomain: 'TU_PROYECTO.firebaseapp.com',
    projectId: 'TU_PROYECTO',
    storageBucket: 'TU_PROYECTO.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  };

})(window.App = window.App || {});
