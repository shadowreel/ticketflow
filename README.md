# TicketFlow — Sistema de Gestión de Incidencias TI

Aplicación de mesa de ayuda (ITSM) construida con **HTML5, CSS3 y JavaScript puro** (sin frameworks, sin build step). Tres roles — Administrador, Técnicos y Usuarios finales — con el ciclo de vida completo de una incidencia: reporte, asignación, seguimiento, resolución y notificaciones en tiempo real.

## Ejecutar en local

No requiere `npm install` ni build. Solo sirve los archivos estáticos:

```bash
python -m http.server 8020
# abre http://localhost:8020
```

(o la extensión "Live Server" de VS Code, o cualquier servidor estático). **No abras `index.html` con doble clic (`file://`)** — el SDK de Supabase y los módulos con `defer` requieren `http://`.

### Cuentas por defecto (se siembran solas al primer arranque)

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin123!` |
| Técnico | `leonel` | `Tecnico123!` |
| Técnico | `nathan` | `Tecnico123!` |
| Técnico | `sheyla` | `Tecnico123!` |

Todas piden crear una contraseña definitiva en el primer inicio de sesión. Los usuarios finales se registran ellos mismos desde la pantalla de login.

## Modo colaborativo (Supabase)

Por defecto la app funciona 100% local (`localStorage`) — perfecta para probar sola, pero **cada navegador ve solo sus propios datos**. Para que varias computadoras compartan los mismos datos en tiempo real durante una demo:

1. Ve a [supabase.com](https://supabase.com) → crea una cuenta gratis (sin tarjeta) → **New project** → elige nombre, contraseña de la base de datos y una región cercana. Espera ~2 minutos a que se aprovisione.
2. **Project Settings → API** → copia el **"Project URL"** y la clave **"anon public"**.
3. Copia `js/core/supabaseConfig.example.js` como `js/core/supabaseConfig.js` y pega ahí tus valores reales (`url` y `anonKey`).
4. Ve a **SQL Editor → New query**, pega TODO el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale a **Run**. Esto crea la tabla, la función de folios y habilita la sincronización en tiempo real.
5. Recarga la app. En **Configuración → Estado de sincronización** debe verse "● Colaborativo (Supabase)".

Si `supabaseConfig.js` no existe o tiene valores de plantilla, la app cae en silencio a `localStorage` — nunca se rompe.

⚠️ La política de la tabla (`for all using (true)`) es intencionalmente abierta para una demo rápida sin autenticación de servidor. No la uses con datos reales/sensibles ni la dejes así indefinidamente — restringe las políticas o el proyecto de Supabase después de la demostración.

## Desplegar en Vercel

1. Sube este repositorio a GitHub (`git remote add origin ...`, `git push -u origin main`).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. Framework preset: **Other** (sitio estático). No hay build command ni output directory que configurar — Vercel sirve `index.html` tal cual.
4. Si quieres modo colaborativo en producción, asegúrate de que `js/core/supabaseConfig.js` con tus credenciales reales esté commiteado en esa rama (recuerda que está en `.gitignore` por defecto — quítalo del `.gitignore` o agrégalo forzado con `git add -f` si de verdad quieres publicarlo así).

## Arquitectura

```
index.html
css/            tokens de diseño, layout, componentes, páginas, motion
js/
  core/         config, utilidades, eventBus, tema/acento, config de Supabase
  data/         storageAdapter (único punto de persistencia) + repositories + bootstrap
  services/     lógica de negocio (auth, incidencias, técnicos, notificaciones, stats)
  ui/           router, componentes (modal, toast, charts, skeleton...) y vistas por pantalla
```

Toda lectura/escritura de datos pasa por **`js/data/storageAdapter.js`** — es el único archivo que sabrá de Google Sheets cuando llegue la Fase 3; el resto de la app no cambia.

## Notas de mantenimiento

- Los `<script>`/`<link>` locales llevan un parámetro `?v=N` para evitar que el navegador sirva versiones cacheadas durante el desarrollo. Súbelo (`?v=6`, `?v=7`...) si haces cambios y no los ves reflejados.
- `legacy/` conserva el prototipo de una iteración anterior solo como referencia; no se usa ni se publica.
