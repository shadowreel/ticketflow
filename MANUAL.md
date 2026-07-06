# Manual completo — TicketFlow (Sistema de Gestión de Incidencias TI)

## 1. ¿Qué es este sistema?

Una aplicación de mesa de ayuda (ITSM) construida con **HTML5, CSS3 y JavaScript puro** (sin frameworks, sin paso de compilación). Permite a una empresa gestionar el ciclo de vida completo de una incidencia técnica: un usuario la reporta, el administrador la asigna a un técnico, el técnico la resuelve, y todos reciben notificaciones en tiempo real en cada paso.

Es **colaborativa**: varias personas, desde distintas computadoras, pueden usarla al mismo tiempo y ver los mismos datos actualizarse en vivo (gracias a Supabase, ver sección 5).

---

## 2. Roles del sistema

| Rol | Puede hacer |
|---|---|
| **Administrador** (uno solo) | Ver todas las incidencias, asignar/reasignar técnicos, cambiar estado y prioridad, eliminar, buscar y filtrar, administrar técnicos y usuarios, configurar categorías/SLA/apariencia, ver estadísticas y dashboard completo. |
| **Técnico** (los crea el admin, cualquier cantidad) | Ver solo las incidencias que le asignaron, actualizar progreso, comentar, registrar causa/solución/materiales/tiempo, marcar como resuelta. |
| **Usuario final** (se registra solo) | Reportar incidencias (con foto de evidencia), ver solo las suyas, comentar, ver su historial y notificaciones. |

---

## 3. Credenciales de acceso

Se siembran solas la primera vez que la app arranca con la base de datos vacía:

| Rol | Usuario | Contraseña inicial |
|---|---|---|
| Administrador | `admin` | `admin` |
| Técnico | `leonel` | `123456789` |
| Técnico | `nathan` | `123456789` |
| Técnico | `sheyla` | `123456789` |

⚠️ **Todas piden crear una contraseña definitiva en el primer inicio de sesión** (medida de seguridad, no se puede omitir). Los usuarios finales se registran ellos mismos desde la pestaña "Usuario final" del login (nombre, correo y contraseña a su elección).

Si alguna vez las contraseñas guardadas dejan de coincidir con lo que esperas (por ejemplo, tras cambiar valores en `js/core/config.js`), usa el enlace **"Reiniciar datos de prueba"** que aparece debajo del formulario de login — borra los datos guardados y vuelve a sembrar las cuentas desde cero.

---

## 4. Ejecutar el proyecto en tu computadora

No requiere instalar nada (`npm install`, build, etc.). Solo necesita un servidor estático simple:

```bash
python -m http.server 8020
```

Y abre `http://localhost:8020` en el navegador. También funciona con la extensión **"Live Server"** de VS Code, o cualquier otro servidor estático.

⚠️ **No abras `index.html` con doble clic** (protocolo `file://`) — el SDK de Supabase y los módulos del proyecto necesitan que el sitio se sirva por `http://`.

---

## 5. Modo colaborativo (Supabase) — ya configurado

Este proyecto ya está conectado a un proyecto real de Supabase (Postgres + tiempo real). Así quedó armado:

1. Cuenta creada en [supabase.com](https://supabase.com) (sin tarjeta, plan gratuito).
2. Proyecto `ticketflow-demo` creado.
3. Credenciales (URL + clave publicable) pegadas en `js/core/supabaseConfig.js` (este archivo **no se sube a GitHub** — está en `.gitignore` porque contiene credenciales; usa `js/core/supabaseConfig.example.js` como plantilla si necesitas configurarlo en otro lugar).
4. El script [`supabase/schema.sql`](supabase/schema.sql) ya se ejecutó en el proyecto — crea la tabla `ticketflow_data`, la función de folios atómicos, y habilita la sincronización en tiempo real.

Puedes confirmar que está activo en **Configuración → Estado de sincronización** dentro de la app: debe decir "● Colaborativo (Supabase)".

Si algún día quieres usar otro proyecto de Supabase (por ejemplo, uno de producción separado de la demo), solo tienes que reemplazar los valores en `js/core/supabaseConfig.js` y volver a correr `supabase/schema.sql` en el proyecto nuevo.

---

## 6. Publicar en GitHub y desplegar en Vercel

### 6.1 Subir el código a GitHub

1. Crea un repositorio nuevo y vacío en [github.com/new](https://github.com/new) (sin README, sin .gitignore — ya los tenemos).
2. En tu terminal, dentro de la carpeta del proyecto:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```
3. Recarga la página de GitHub — deberías ver todos los archivos del proyecto.

### 6.2 Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) e inicia sesión (puedes usar tu cuenta de GitHub).
2. Clic en **"Add New" → "Project"**.
3. Selecciona el repositorio que acabas de subir.
4. En **Framework Preset** elige **"Other"** (sitio estático) — no hay build command ni output directory que configurar, Vercel sirve `index.html` tal cual.
5. Clic en **"Deploy"**.
6. En 30-60 segundos tendrás una URL pública tipo `https://tu-proyecto.vercel.app`.

### 6.3 Importante: las credenciales de Supabase en producción

`js/core/supabaseConfig.js` está en `.gitignore` (no se sube a GitHub) por buenas prácticas. Para que la versión desplegada en Vercel también sea colaborativa, tienes dos opciones:

- **Opción simple (recomendada para una demo):** quita esa línea del `.gitignore` y sube el archivo con tus credenciales reales tal como está. Como es la clave "publicable" (segura para exponer en el navegador) y el acceso a la tabla ya está controlado por Supabase, no representa un riesgo grave para una demo.
- **Opción más prolija:** vuelve a crear `js/core/supabaseConfig.js` directamente en el repositorio de GitHub (editar archivo en la web de GitHub) con los valores reales, sin tocar tu `.gitignore` local.

Después de subir el archivo, Vercel vuelve a desplegar automáticamente.

---

## 7. Mantenimiento y solución de problemas

- **Los cambios de código no se ven reflejados:** los `<script>`/`<link>` locales llevan un parámetro `?v=N` para evitar que el navegador use versiones cacheadas. Súbelo (`?v=13`, `?v=14`...) en `index.html` si haces cambios y no los ves.
- **Respaldo de datos:** en Configuración → Respaldo de datos puedes exportar/importar toda la información como un archivo JSON, sin importar si estás en modo local o colaborativo.
- **Restablecer todo:** el enlace "Reiniciar datos de prueba" en el login borra los datos guardados en este navegador y vuelve a sembrar las cuentas iniciales. En modo colaborativo (Supabase), esto solo borra los datos **locales** de ese navegador — para vaciar la base de datos compartida, hazlo desde el **Table Editor** de Supabase.
- **`legacy/`** conserva un prototipo de una iteración anterior, solo como referencia; no se usa ni se publica.

---

## 8. Estructura del proyecto

```
index.html
css/                     tokens de diseño, layout, componentes, páginas, animaciones
js/
  core/                  config, utilidades, eventBus, tema/acento, config de Supabase
  data/                  storageAdapter (único punto de persistencia) + repositories + bootstrap
  services/              lógica de negocio (auth, incidencias, técnicos, notificaciones, stats)
  ui/                    router, componentes (modal, toast, charts, skeleton...) y vistas por pantalla
supabase/schema.sql      script SQL para configurar la base de datos de Supabase
```

Toda lectura/escritura de datos pasa por **`js/data/storageAdapter.js`** — es el único archivo que habría que tocar si en el futuro se quisiera conectar otro backend (por ejemplo, Google Sheets); el resto de la app no cambia.
