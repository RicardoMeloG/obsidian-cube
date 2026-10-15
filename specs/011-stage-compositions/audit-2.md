# Auditoría de desvío 2: después de S4 (el escenario en pantallas apiladas y el retiro de los rieles), con el admin de S3

Hecha el 2026-10-15 sobre la rama `concept/escenario`, con S4 todavía sin commit (base `d4c8e00`). Es el segundo punto de control de la sección 5 de la spec. Incluye el admin construido en S3, que no tenía punto de control propio y toca reglas de seguridad del admin.

## Método

`node scripts/audit-drift.mjs`: dos auditores locales sin contexto previo, cada uno por separado, `qwen3.6:27b` (con razonamiento) y `gemma4:31b`. Cada uno recibió las reglas declaradas (extractos de `AGENTS.md`, la spec 011 completa y la tabla de dependencias de `docs/architecture.md`) y el código en cuatro partes, para que cupiera en el contexto:

- `s4-ui`: `Experience.tsx`, `StageView.tsx`, `stage.css` y `experienceStore.ts`.
- `s4-content`: `siteContent.ts`, `publishRules.ts`, el contenido de estrés y el diff de `check-layout.mjs`.
- `s3-server`: los controladores y servicios de contenido y de imágenes, y `main.ts`.
- `s3-form`: `form.js`.

La consigna fue informar solo desvíos demostrables, citando a la vez el código y la regla. Claude verificó cada hallazgo contra el código.

Dos incidencias del propio método, ya corregidas en el script:

- El primer intento cortó por el tiempo de espera de cabeceras de `fetch`: qwen razonó más de cinco minutos. Ahora el script recibe la respuesta en streaming.
- Respuestas vacías: gemma devolvió un error con los prompts más grandes y a qwen se le acabó el contexto mientras razonaba. Ahora el script registra el error y el motivo de término, y la auditoría se divide en partes.

## Hallazgos

| Id | Hallazgo | Quién | Veredicto | Resolución |
|---|---|---|---|---|
| F-1 | Al reescribir la medición para el escenario, `check-layout.mjs` perdió la prueba de que el nombre no queda tapado («not covered by any layer»). Conservaba «h1 único» y «arriba a la izquierda». | ambos | **Confirmado.** Regresión de la barrera H-06. | La prueba de impacto volvió a `measureStage`. Sonda: una capa inyectada en el build sobre el nombre da `name-covered` en todas las caras; sin la sonda, el chequeo pasa. |
| F-2 | El contador `01 / 06` se calcula en `StageView.tsx`, pero AD-02 lo pone en `copy.ts`. | qwen | **Confirmado**: la spec y el código no coincidían. | La spec se corrige: el contador no tiene palabras y su formato numérico vive con el escenario (`motion.ts`). `copy.ts` sigue reservado para los textos. |
| F-3 | `form.js` tiene 351 líneas, más que el límite de 250. | ambos | **Confirmado en el fondo.** La regla solo cubría las capas DOM de `src/`, pero el archivo hacía tres cosas. | Dividido en `form-kit.js` (67 líneas: utilidades de esquema), `form-media.js` (79: campo de imagen y WebP) y `form.js` (228: el generador). `fileSize.test.ts` mide ahora también `server/admin/*.js`. El script en línea de `index.html` queda sin medir (**unchecked**). |
| F-4 | `Experience.tsx` importa `features/dev`, que la regla de `features/experience` prohíbe. | gemma | **Rechazado.** `Experience.tsx` está en `src/app`, que no tiene restricciones. | — |
| F-5 | Los mensajes de error del servidor y los textos de `form.js` están en español y no en `copy.ts`. | gemma, qwen | **Rechazado.** `copy.ts` es el diccionario del sitio bilingüe. El admin es una página solo en español, y el servidor ya respondía en español. | — |
| F-6 | `form.js` usa `#000000` como valor inicial del selector de color, y no un token. | qwen | **Rechazado.** `check:tokens` cubre el sitio; el admin tiene su propia paleta en la página. | — |
| F-7 | La página del admin y sus scripts se sirven sin `AuthGuard`. | qwen (primer intento) | **Rechazado.** La página contiene el formulario de inicio de sesión y tiene que cargar sin sesión; sus scripts son código público del repositorio. Todas las rutas de datos (`/api/*` y `/content/media/*`) exigen la sesión completa: 401 sin sesión, comprobado a mano el 2026-10-15. | — |

## Lo que no cubrió

Los auditores leyeron código y reglas; no ejecutaron nada. En tiempo de ejecución cubren las barreras, todas en verde al cerrar este registro:

- **Layout:** el chequeo pasa en la matriz completa (9 tamaños, 2 idiomas) con el contenido construido, el de ejemplo y el de estrés, incluidas degradación y comportamiento.
- **Admin:** pasa `check:admin`.
- **Peso:** la primera vista mide 454,8 KB, dentro del límite de 455,3 KB.
- **Recorrido visual:** el escenario a 1440×900, 1366×768 y 390×844 en los dos idiomas, sin errores de página.
