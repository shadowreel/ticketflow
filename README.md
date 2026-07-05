# TicketFlow — Sistema de Gestión de Incidencias TI

Aplicación de mesa de ayuda (ITSM) construida con **HTML5, CSS3 y JavaScript puro** (sin frameworks, sin build step). Tres roles — Administrador, Técnicos y Usuarios finales — con el ciclo de vida completo de una incidencia: reporte, asignación, seguimiento, resolución y notificaciones en tiempo real.

## Ejecutar en local

No requiere `npm install` ni build. Solo sirve los archivos estáticos:

```bash
python -m http.server 8020
# abre http://localhost:8020
```

(o la extensión "Live Server" de VS Code, o cualquier servidor estático). **No abras `index.html` con doble clic (`file://`)** — el SDK de Firebase y los módulos con `defer` requieren `http://`.

### Cuentas por defecto (se siembran solas al primer arranque)

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin123!` |
| Técnico | `leonel` | `Tecnico123!` |
| Técnico | `nathan` | `Tecnico123!` |
| Técnico | `sheyla` | `Tecnico123!` |

Todas piden crear una contraseña definitiva en el primer inicio de sesión. Los usuarios finales se registran ellos mismos desde la pantalla de login.

## Modo colaborativo (Firebase Firestore)

Por defecto la app funciona 100% local (`localStorage`) — perfecta para probar sola, pero **cada navegador ve solo sus propios datos**. Para que varias computadoras compartan los mismos datos en tiempo real durante una demo:

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → crea un proyecto gratuito.
2. **Compilación → Firestore Database → Crear base de datos** (modo de prueba).
3. **Configuración del proyecto → Tus apps → ícono Web (`</>`)** → registra la app → copia el objeto `firebaseConfig`.
4. Copia `js/core/firebaseConfig.example.js` como `js/core/firebaseConfig.js` y pega ahí tus valores reales.
5. En **Firestore → Reglas**, para la demo (regla abierta a propósito, no usar así en producción):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
6. Recarga la app. En **Configuración → Estado de sincronización** debe verse "● Colaborativo (Firebase)".

Si `firebaseConfig.js` no existe o tiene valores de plantilla, la app cae en silencio a `localStorage` — nunca se rompe.

⚠️ La regla abierta (`allow read, write: if true`) es intencional para una demo rápida sin autenticación de servidor. No la uses con datos reales/sensibles ni la dejes así indefinidamente — bórrala o restringe el proyecto de Firebase después de la demostración.

## Desplegar en Vercel

1. Sube este repositorio a GitHub (`git remote add origin ...`, `git push -u origin main`).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. Framework preset: **Other** (sitio estático). No hay build command ni output directory que configurar — Vercel sirve `index.html` tal cual.
4. Si quieres modo colaborativo en producción, asegúrate de que `js/core/firebaseConfig.js` con tus credenciales reales esté commiteado en esa rama (recuerda que está en `.gitignore` por defecto — quítalo del `.gitignore` o agrégalo forzado con `git add -f` si de verdad quieres publicarlo así).

## Arquitectura

```
index.html
css/            tokens de diseño, layout, componentes, páginas, motion
js/
  core/         config, utilidades, eventBus, tema/acento, config de Firebase
  data/         storageAdapter (único punto de persistencia) + repositories + bootstrap
  services/     lógica de negocio (auth, incidencias, técnicos, notificaciones, stats)
  ui/           router, componentes (modal, toast, charts, skeleton...) y vistas por pantalla
```

Toda lectura/escritura de datos pasa por **`js/data/storageAdapter.js`** — es el único archivo que sabrá de Google Sheets cuando llegue la Fase 3; el resto de la app no cambia.

## Notas de mantenimiento

- Los `<script>`/`<link>` locales llevan un parámetro `?v=N` para evitar que el navegador sirva versiones cacheadas durante el desarrollo. Súbelo (`?v=6`, `?v=7`...) si haces cambios y no los ves reflejados.
- `legacy/` conserva el prototipo de una iteración anterior solo como referencia; no se usa ni se publica.
