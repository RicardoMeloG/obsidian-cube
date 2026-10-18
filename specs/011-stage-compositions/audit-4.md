# Auditoría 4: lo que cambió después de la auditoría 3 (el modo `APP_ENV`, el bypass del login y el retiro de `cta`)

Hecha el 2026-10-18 sobre `main`, HEAD `ec8306f`. El alcance son los dos commits posteriores a la auditoría 3: `b3e8c61` (el modo de desarrollo en `.env` y el bypass del login del admin) y `d09324d` (el retiro del campo heredado `cta`), además de la documentación de `ec8306f`. Se pidió antes de entrar a la etapa de contenido, porque el bypass cambia la autenticación y hasta ese momento solo lo había revisado el agente que lo escribió.

## Método

El auditor fue un subagente de Claude (Opus 5.5), sin contexto previo, con una consigna escrita de antemano. Es el mismo modelo que hizo los cambios: el auditor no heredó los supuestos de esa sesión, pero tampoco aporta un modelo distinto, como sí hizo la auditoría 3.

La consigna fijaba:
- **Lecturas obligatorias:** `AGENTS.md` completo, la tabla de reglas de `docs/architecture.md`, la ADR 004, `.env.example`, las etapas del roadmap y el estado de esta spec.
- **Solo lectura del repositorio:** las sondas, en una carpeta temporal fuera de él.
- **Nada de `.env` ni de `public/content/`**, y nada de datos personales.
- **Puertas permitidas:** las rápidas.
- **Puertas prohibidas:** `check:layout` y el recorrido visual, que habían corrido en verde ese día.
- **Sondas del bypass:** permitidas en vivo, solo con peticiones de lectura.
- **Informe:** cada hallazgo con archivo y línea, la regla citada, cinco líneas de evidencia como máximo, cada afirmación marcada como medida o inferida y un escenario concreto de falla.

Corrió en verde `lint`, `tsc -b`, `typecheck:server`, `test` (153 pruebas) y `check:admin`. Sus sondas:
- una prueba temporal que comparó la decisión del esquema publicable anterior (de `8833ab5`) con `ContentService.validate`, sobre ocho variantes del contenido de ejemplo y de estrés;
- el guard y `/auth/me` ejercidos directamente;
- el arranque con `APP_ENV=production ADMIN_AUTH=off` y con `APP_ENV=prod`: los dos terminan con código 1;
- quince peticiones de lectura al admin en vivo, con cabeceras Host, Origin y `X-Forwarded-For` variadas.

El informe íntegro quedó fuera del repositorio, en la máquina del dueño. Aquí se registra lo verificado: Claude comprobó cada hallazgo contra el código, y F-1 además en un navegador.

## Hallazgos

| Id | Hallazgo | Veredicto | Resolución |
|---|---|---|---|
| F-1 (media) | Con `ADMIN_AUTH=off`, una página abierta en el navegador del dueño podía cargar el admin dentro de un marco invisible y hacer que el dueño lo usara con sus propios clics; por ejemplo, poner un botón suyo sobre «Publicar». El admin no enviaba `X-Frame-Options` ni `frame-ancestors`. Dentro del marco, las peticiones del admin son del mismo origen: los GET van sin Origin y los POST con el Origin del admin, así que pasan el chequeo del bypass. Publicar no pide confirmación. Antes del bypass no ocurría, porque la cookie de sesión (`SameSite=lax`) no llega a un marco dentro de otro sitio y el marco mostraba el login. El comentario de `devBypass.ts` prometía lo contrario: «a page open in the browser cannot drive the admin». | **Confirmado**, y reproducido en Chromium con Playwright: una página servida en `127.0.0.1:5199` enmarcó `http://127.0.0.1:5182/`, y dentro del marco `/auth/me` respondió `authenticated: true, bypass: true`. | `server/noFraming.ts` envía `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'` en todas las respuestas; `main.ts` lo instala antes de la sesión y de cualquier ruta. La vista previa del admin enmarca el sitio en 5180, no el admin, así que no cambia. Lo prueba `server/noFraming.test.ts`, que exige las dos cabeceras y que el middleware esté instalado antes de la sesión. Repetida la sonda con la corrección: Chromium rechaza el marco («violates the following Content Security Policy directive: "frame-ancestors 'none'"»), mientras el admin abierto directamente funciona igual. Corregido el comentario de `devBypass.ts`. `AGENTS.md` y `docs/architecture.md` lo dicen. |
| F-2 (baja) | Las pruebas cubrían solo las funciones auxiliares (`bypasses`, `appEnv`). Ninguna importaba `AuthGuard`, `AuthController` ni `ContentService`, mientras `docs/architecture.md` decía que «`ContentService.validate` applies it». Un refactor que moviera el bypass del guard, o que dejara de bloquear en producción, pasaba las 153 pruebas. | **Confirmado.** | `server/auth/auth.guard.test.ts` prueba el guard y `/auth/me`: sin bypass piden sesión completa; con el bypass dejan pasar solo la petición local, y rechazan un Origin ajeno y otra máquina. `server/content/content.service.test.ts` prueba `validate`: en producción bloquea con exactamente las reglas, en desarrollo deja pasar y las devuelve como avisos, y la forma bloquea en los dos. Usa el ejemplo como el otro idioma, así que no lee los documentos privados. Las dos pruebas fallan si se quita el bypass del guard o el bloqueo en producción; se comprobó rompiendo cada línea a propósito. |
| F-3 (baja) | En producción la lista de errores ya no es la de antes. Cuando la forma falla en una comprobación que Zod considera continuable (largo de una lista, `min(1)`), el esquema anterior reportaba también las reglas, y ahora solo se reporta la forma: en una sonda, 10 errores antes y 1 ahora. La decisión de aceptar o rechazar es la misma en las ocho variantes. | **Confirmado** en el código (`content.service.ts`: las reglas se calculan solo si la forma pasa). | Se acepta: el dueño corrige primero la forma y después ve las reglas, a lo más una vuelta más. Queda escrito en el flujo de publicación de `docs/architecture.md`. |
| F-4 (baja, más adelante) | Un `APP_ENV` ausente cuenta como desarrollo. Hoy es lo correcto, pero en la Lambda del admin con Cognito una variable olvidada por la infraestructura convertiría las reglas de publicación en avisos, en producción. | **Confirmado** como riesgo futuro; hoy no existe la Lambda. | Anotado en el paso del release de `docs/roadmap.md`: allá un valor ausente es un error, no desarrollo. |

Detalles menores del informe, resueltos:
- Con el bypass activo, «Salir» recargaba la página y volvía a entrar sin login. Ahora el admin lo oculta mientras el bypass esté activo.
- Quedaba un `cta: undefined` suelto en `scripts/checks/stressContent.test.ts`. Se borró.

## Lo que resistió

Medido por el auditor y comprobado aquí contra el código:
- **La red:** nada fuera de la máquina llega al admin. Escucha solo en `127.0.0.1`.
- **Una página que llama a la API:** con un Origin ajeno, `null` o el del sitio en 5180, `/auth/me` responde no autenticado y las rutas protegidas responden 401.
- **Rebinding de DNS:** una cabecera Host ajena se rechaza, y también una en mayúsculas o sin puerto. Falla cerrado.
- **Proxies:** el chequeo usa la dirección del socket, así que `X-Forwarded-For` no influye.
- **Arranque:** con `APP_ENV=production` y el bypass, el servidor no arranca. Tampoco con un valor de `APP_ENV` que no conoce, como `Production`, `prod` o `production` con un espacio.
- **Camino a producción:** el bypass no tiene ninguno. `server/` no entra en el build de Vite, y ni `infra/` ni `.github/` lo usan.
- **Reglas en producción:** el refactor acepta y rechaza exactamente lo mismo que antes, y las rutas de los avisos apuntan al campo del documento tal como se escribió, aun con las caras desordenadas o un id repetido.
- **`cta`:** nada lo usa. Un documento antiguo que lo traiga se lee y la clave se descarta.
- **Documentación:** calzaba con el código, salvo lo que corrigen F-1 y F-2.

## Lo que no cubrió

- Las puertas pesadas y de build (`build`, `check:budget`, `check:privacy`, `check:docs`, `check:tokens`, `check:layout` y el recorrido), por consigna. Las pesadas las corrió la revisión del mismo día (ver el estado de la spec). Después de estas correcciones se repitieron en verde `lint`, `tsc -b`, `typecheck:server`, `test` (160 pruebas), `check:admin`, `check:docs`, `check:privacy` y `check:tokens`. No cambió nada del sitio, así que `check:layout` y `check:budget` no se repitieron.
- Cómo se comporta en cada navegador el permiso de acceso a la red local, Local Network Access de Chrome.
- WSL en modo de red espejo, o contenedores que alcancen el loopback de la máquina.
- Versiones y restauración con Postgres levantado.
