# Auditoría independiente 2: arquitectura construida (cierre de la etapa de normalización, ADR 007)

Auditado sobre `E:\Proyectos\obsidian-cube`, rama `feature/cube-intro`, HEAD `345ecaa`, el 2026-10-12. Árbol de trabajo limpio al empezar y al terminar (`git status --short` vacío; solo quedan ignorados `dist/`, `infra/cdk.out/`, `.env`, `.privacy-denylist` y `public/content/site.{en,es}.json`; no existe `visual.json`). No abrí `.env`, `.privacy-denylist` ni los JSON privados. Todas las sondas fueron temporales y las revertí (detalle en la sección 5).

## 1. Veredicto

**Cerrar con cambios menores.** La arquitectura declarada está aplicada de verdad: los módulos y sus dependencias coinciden con `docs/architecture.md`, el store de la experiencia es la única unión entre escena y DOM, `App.css` ya no existe, el `<dialog>` es nativo, la CSP se aplica en `vite preview` y todas las barreras pasan, incluida la matriz completa con contenido de estrés. Pero la afirmación «toda regla presentada como vigente está vigente» no se cumple del todo:

- Hay dos defectos del contrato de contenido. B-01: el contenido de ejemplo con marcadores puede llegar al sitio público aunque las reglas de publicación lo acepten. B-03: el HTML estático ignora `ctaPrimary`.
- Una regla dura, el contraste AA del nombre, no tiene ninguna barrera, aunque H-06 dice que se mide.
- Varias barreras tienen huecos que no están declarados.

Son arreglos acotados. Hay que resolver B-01 a B-03 y, en cada hueco, implementar la barrera o etiquetar la regla como «unchecked». Con eso la etapa se puede cerrar.

## 2. Reglas y barreras

| Regla | Barrera | ¿Falla de verdad al romperla? | Evidencia |
|---|---|---|---|
| Datos personales fuera del repositorio | `check:privacy` (CI + pre-push; `core.hooksPath=.githooks` activo) | **Parcial** | Sonda: un archivo sin seguimiento con `someone@example.com` da «1 findings». Pero `--history` solo lee autores y mensajes (`scripts/check-privacy.mjs:126-133`), no el contenido de commits pasados. E-22 (un nombre de cliente en dos versiones antiguas de `vite.config.ts`) es indetectable, aunque spec §9 D-5 y §12 dicen que H-08a «must scan history contents» |
| Build, lint y tests | CI | Sí | Todo en verde (sección 5) |
| El CDK sintetiza | CI `infra` | No verificado | Fuera de la lista pedida; no lo ejecuté |
| Servidor con lint y tipos | `npm run lint`, `typecheck:server` | Sí | Sonda lint: `server/probe.ts` → `../src/features/...` se bloquea |
| Kernel puro; el servidor solo importa el kernel | `tsconfig.kernel.json` + lint | **Parcial** | Sonda en `src/kernel/zzProbe.ts`: `import('three')` dinámico y `import … from '../../scripts/checks/budget.json'` pasan lint **y** `tsc -p tsconfig.kernel.json` (exit 0). `../lib/hasWebGL` pasa el lint (el regex de `eslint.config.js:103` omite `lib`), pero `tsc` lo detecta (`document`) |
| El contenido del dueño gana; el campo que falta viene del ejemplo | `src/kernel/siteContent.test.ts` | Sí, pero con efecto no deseado | Ver B-01 |
| Activos con fuente y licencia | `scripts/checks/assets.test.ts` | Sí (leído, no sondeado) | Hay 2 pendientes conocidos |
| Layout: ninguna columna sobre la franja, CTA visibles, nombre primero y sin tapar | `check:layout` | **Sí** | Sonda: CSS inyectado en `dist/seo-fallback.css` (franja a 45vh y cabecera desplazada) produce 90 fallos nuevos (`rail-*-over-strip`, `name-position`, `cta-*-under-strip`); exit 1 |
| El contenido dentro de su presupuesto cabe | `check:layout --content=stress` | Sí | Matriz completa en verde; avisos `rail-left-scrolls` en 1600×725 y 1280×720, ya documentados en spec §12 P2a |
| Una sola fuente de modos; sin breakpoints numéricos | `src/styles/layoutModes.test.ts` | **Parcial** | Sonda: `export const isWide = (width: number) => width < 900` y `'md:hidden max-[900px]:block'` en `src/features/faces/zzProbe.tsx` → 4/4 tests pasan. El regex (`layoutModes.test.ts:45`) solo ve `innerWidth|size.width|viewport.width`, y los breakpoints por defecto de Tailwind siguen activos |
| Sin página en blanco | Degradación en `check:layout` | Sí (verde; no sondeado) | `degradation: 0 failures` |
| Accesibilidad: sin violaciones axe | `check:layout` (axe) | **Sí, salvo contraste** | Sonda axe `color-contrast`: en 1366×768 da 0 violaciones, **0 pasan** y 42 «incomplete» («background color could not be determined»); en 390×844, 0/0/38. El contraste del `h1`, el rol y la franja nunca se evalúa |
| Nombre y rol con contraste AA (`AGENTS.md`, Hard Rules; spec H-06 «contrast… computed against the declared scrim token») | Ninguna | **No** | `scripts/check-layout.mjs:104-172` no calcula contraste. Ver B-02 |
| Cabeceras de seguridad; nada inline en `index.html` | CSP en `vite preview` + `indexHtml.test.ts` | **Sí** | Sonda: un `<style>` inyectado desde `dist/js-flag.js` da 7 fallos `NEW layout: csp …`; exit 1 |
| Presupuesto de primera vista (trinquete) | `check:budget` | Sí; el trinquete puede subir | 547.671 B frente a un límite de 552.946. Con `--update` el límite pasaría a 553.148 (**sube**), porque `check-budget.mjs:188` usa `total*1.01` |
| El deploy nunca borra contenido | `deployWorkflow.test.ts` | **Parcial** | Sonda: añadir `aws s3 cp dist/content/ … --recursive` y `aws s3 rm s3://…/content/ --recursive` a `deploy.yml` → 3/3 tests pasan. El test solo mira las líneas `aws s3 sync` (`deployWorkflow.test.ts:14`) |
| Sin literales de color fuera de los tokens | `check:tokens` | **Parcial** | Sonda: `color: red`, `oklch(0.7 0.2 30)` en `FaceRails.css` y `text-red-500 bg-white` en `RotateHint.tsx` → «0 problems». El regex solo reconoce hex, rgb y hsl (`check-tokens.mjs:13`); la paleta por defecto de Tailwind no está anulada; `public/seo-fallback.css:6-7` tiene hex y no se escanea (solo se recorre `src/`, `:33`) |
| Fronteras de módulos; sin comparar locales ni carga diferida en la interfaz | `npm run lint` + `boundaries.test.ts` | **Parcial** | Sonda (ESLint `lintText`): `locale === 'es'` se bloquea, pero `switch (locale) { case 'es' }`, `({en,es})[locale]` y `locale.startsWith('es')` pasan; `import()` pasa en `features/content`, `features/dev` y `kernel` (la regla `DYNAMIC_IMPORT` solo cubre ui, lib, styles, experience, faces, navigation y audio: `eslint.config.js:79-87`) |
| Archivos de la capa DOM ≤ 250 líneas | `fileSize.test.ts` | **Parcial** | Sonda: 300 líneas en `src/features/dev/` pasan y en `src/features/faces/` fallan. `dev` no está en `DOM_LAYERS` (`fileSize.test.ts:10`), y `VectorWorldShowcase.tsx` ya tiene 310 líneas |
| Se sirve la fuente medida (Inter) | `font-not-loaded` | Sí (verde; no sondeado) | — |
| Sin medidas sin fecha en los documentos vivos | `check:docs` | Sí, con escape | Sonda: «The bundle weighs 900 KB.» falla; «… 900 KB, see <dialog>.» pasa, porque cualquier `<` o las palabras «limit», «budget» o «under» lo eximen (`check-docs.mjs:56`) |
| `docs/architecture.md` al día | Unchecked (plantilla de PR) | Etiquetada con honestidad | — |
| CSS escrito a mano en la capa `components` y comentado (`AGENTS.md`, Styling) | Ninguna | No, y no dice «unchecked» | — |
| Textos de interfaz desde `copy.ts` | Parcial (lint de locales + test de claves) | Un `aria-label="Close"` escrito a mano no falla; no dice «unchecked» | — |
| El deploy solo después de las barreras (diagrama de `docs/architecture.md:18`, «gates, deploy code only») | Ninguna | **No** | `deploy.yml` corre con un push a `main` sin `needs` ni `workflow_run` del CI; solo ejecuta `npm run build` |

## 3. Hallazgos

### Severidad alta

**B-01: el ejemplo, con sus marcadores, puede llegar al sitio público aunque las reglas de publicación lo acepten**
- Dónde: `src/kernel/siteContent.ts:117-143` (`normalizeSections`) frente a `src/kernel/publishRules.ts:38-96`.
- Problema: las reglas de publicación validan el documento tal cual. Pero el sitio rellena cada campo opcional vacío (`ctaPrimary`, `ctaSecondary`, `detail`, `features`…) con el ejemplo del mismo idioma. El ejemplo tiene marcadores en PRODUCTS (`ctaPrimary`, `detail`) y en CONTACT (`ctaSecondary`, `detail`). Un documento sin ningún problema de publicación termina mostrando `github.com/your-handle/your-project` al visitante. Esto contradice «no example placeholders» (`docs/architecture.md:82`) y la separación entre ejemplo y contenido privado.
- Evidencia: sonda temporal (`scripts/checks/zzProbe.test.ts`, ya borrada). Tomé el ejemplo con los marcadores sustituidos y le quité `ctaPrimary` a PRODUCTS. Resultado: `publishIssues → []` y `placeholderRendered: true`.
- Recomendación: aplicar `publishIssues` al resultado normalizado (lo que se va a renderizar) y no solo al documento. También se puede limitar el relleno a los campos obligatorios, o dejar sin marcadores los campos opcionales del ejemplo. Añadir un test con este caso.

**B-02: el contraste AA del nombre se presenta como vigente y no tiene barrera**
- Dónde: `AGENTS.md`, Hard Rules («must meet AA contrast»); spec 010 §6 H-06 («Contrast of the name is computed against the declared scrim token»), marcada como vigente en `docs/architecture.md:97,101`; `scripts/check-layout.mjs:104-172`.
- Problema: el chequeo de layout no calcula contraste. axe no puede calcularlo sobre este fondo (degradados, pseudoelementos e imagen), así que «0 violaciones» no dice nada del contraste. Además, axe solo se ejecuta sobre la cara inicial y nunca con el diálogo abierto (`check-layout.mjs:215-217`). Hay tonos que probablemente no cumplen la regla de `docs/visual-direction.md` (AA, o 3:1 con ≥14 px). Por ejemplo, el nombre de la franja es `text-ink-200/42` a 0,6 rem (`FaceStrip.tsx:96`). Esto es una estimación y no está medido.
- Evidencia: sonda axe (sección 2): 0 nodos evaluados y 42/38 «incomplete».
- Recomendación: hacer lo que dice H-06 y calcular en `measureFace` el contraste del `h1` y del rol contra el token del scrim declarado. Si no se hace, marcar el contraste como «unchecked» en `AGENTS.md` y en `docs/architecture.md`.

**B-03: el HTML estático y el JSON-LD ignoran `ctaPrimary`, porque leen el campo heredado `cta`**
- Dónde: `src/kernel/seo/renderSeo.ts:20,71`; el test usa el mismo campo heredado (`renderSeo.test.ts:21`).
- Problema: `publicLinks` recorre `[section.cta, section.ctaSecondary, …detail.links]`. Ningún contenido usa `cta`; el contrato vigente es `ctaPrimary`. Un enlace que solo está en `ctaPrimary` no aparece para los rastreadores que no ejecutan JavaScript ni en `sameAs`, y esa es la audiencia 2 de `AGENTS.md`.
- Evidencia: sonda con `node` sobre una copia de `renderSeo.ts`: con un `ctaPrimary` exclusivo (`https://example.com/only-primary`) el resultado es `primary-only link rendered: false`. Hoy no se nota porque el único `ctaPrimary` con `https` del ejemplo también aparece en `detail.links`.
- Recomendación: usar `ctaPrimary`, derivar `SeoInput` del esquema (`SiteContent`) en lugar de duplicarlo a mano, y corregir el fixture del test.

### Severidad media

**B-04: `check:tokens` es más débil que la regla «no colour literal outside the tokens»**
- Evidencia: sondas de la sección 2 (`red`, `oklch`, `text-red-500`, `bg-white` pasan). La paleta por defecto de Tailwind está activa: `shell.css` y `DetailDialog.css` usan `--color-white` y `--color-black`, que no están en `tokens.css`. `public/seo-fallback.css` no se escanea.
- Recomendación: en `@theme`, `--color-*: initial;` y declarar `white` y `black` como tokens; ampliar el regex a colores con nombre, `oklch`, `hwb` y `lab`; escanear `public/*.css` con una exención explícita para el fallback.

**B-05: la prueba «sin breakpoints numéricos» se puede eludir**
- Evidencia: sonda (`width < 900` en una variable; `md:` y `max-[900px]:` pasan). `tokens.css` no anula `--breakpoint-*`.
- Recomendación: `--breakpoint-*: initial;` en `tokens.css` (así `md:` deja de existir) y prohibir con lint (`no-restricted-syntax`) las comparaciones numéricas sobre `width` y `height` fuera de `layoutModes.ts`. Si no, decir el alcance real del test.

**B-06: las reglas de lint tienen huecos que no están declarados**
- Problema: `import()` está permitido en `features/content`, `features/dev` y `src/kernel`. Comparar locales con `switch`, con un objeto indexado o con `startsWith` pasa. El kernel puede importar por ruta relativa `../lib`, `../../scripts` o `../../server` (`eslint.config.js:99-104`). `docs/architecture.md:76` afirma lo contrario.
- Recomendación: aplicar `DYNAMIC_IMPORT` a todo `src/` salvo `features/scene/vector-worlds/registry.ts` y `app/App.tsx`; en el kernel, permitir solo `./`, `zod` y `../../public/content/*.example.*.json`; añadir esos casos a `boundaries.test.ts`.

**B-07: H-08a no escanea el contenido del historial (E-22)**
- Dónde: `scripts/check-privacy.mjs:126-133`; spec §9 D-5 y §12 E-22.
- Problema: `docs/architecture.md:90` presenta `--history` como la barrera «before publishing a repository», pero esa opción no detectaría el caso que el propio spec documenta.
- Recomendación: con `--history`, recorrer `git log --all -p` (o `git grep <valor> $(git rev-list --all)`) y buscar los valores privados. La decisión D-5 es de la etapa de publicación, pero la barrera ya figura como vigente.

**B-08: el deploy no depende de las barreras y su test solo ve `sync`**
- Dónde: `.github/workflows/deploy.yml` (sin `needs` ni `workflow_run`); `scripts/checks/deployWorkflow.test.ts:14`.
- Problema: un push a `main` despliega aunque CI falle. Las ramas protegidas no se ven en el repositorio, así que no se pueden suponer. Si se añadiera `aws s3 cp` o `aws s3 rm` sobre `content/`, el test seguiría verde.
- Recomendación: usar `on: workflow_run` del CI con `conclusion == success` (o ejecutar las barreras dentro de `deploy.yml`), y que el test rechace cualquier `aws s3 (cp|rm|mv)` que toque `content/`.

**B-09: el README no está normalizado, aunque forma parte del alcance de la etapa (ADR 007, punto 1)**
- Dónde: `README.md:86-88` («Status (2026-10-09)»: no habla de etapas, normalización ni barreras actuales) y `README.md:90-97` (el orden de lectura omite `docs/architecture.md`, que `CLAUDE.md` exige leer antes de tocar código).
- Problema: el README no explica la arquitectura ni el método. El ítem de MVP «README explains the agentic process and architecture» sigue sin marcar en `AGENTS.md`. En los comandos falta `npx playwright install chromium`, que `check:layout` necesita.
- Recomendación: actualizar el estado, enlazar `docs/architecture.md` y resumir en un párrafo los módulos y las barreras.

**B-10: hay nueve modos de layout y lo declarado son tres**
- Dónde: `src/styles/layoutModes.ts:17-27` (`stacked`, `stackedWide`, `narrow` 720, `tight` 1100, `phone` 680, `phoneSmall` 389, `tiny` 340, `desktop`, `desktopShort`) frente a `AGENTS.md` (Layout modes: «stacked, desktop, desktop-short»), ADR 006 y `docs/architecture.md:52`.
- Problema: AD-06 descartó «one breakpoint per screen size (unbounded)», y `narrow` (720) y `phone` (680) se separan solo por 40 px. La única fuente existe y está probada, pero el conjunto creció sin quedar registrado en ADR 006 ni en `AGENTS.md`. Solo lo menciona spec §12 P2b.
- Recomendación: declarar en `docs/architecture.md` y `AGENTS.md` que hay tres modos y seis refinamientos de ancho, explicar el porqué, y valorar si `narrow` y `phone` se pueden fusionar.

**B-11: el contrato de contenido arrastra campos heredados**
- Dónde: `intro`, `highlights`, `proofPoints`, `links` y `cta` en `src/kernel/faces.ts:71-79`, `src/kernel/siteContent.ts:56-60,130-134`, y el respaldo del diálogo en `src/app/Experience.tsx:83-93`.
- Problema: ningún ejemplo los usa y no están en la «Face content shape» de `AGENTS.md`. Las reglas de publicación no validan sus `href` (`publishRules.ts:78-82`), pero `links[].href` se renderiza como `<a>` en el diálogo (`DetailDialog.tsx:130-131`). Así queda parcialmente abierto A-23, y además provocan B-03. `CubeSection` (`faces.ts`) y `SeoInput` (`renderSeo.ts:11-24`) duplican a mano la forma que ya infiere Zod.
- Recomendación: quitar esos campos con un cambio `refactor(content)!`, o validarlos y documentarlos; derivar los tipos del esquema.

**B-12: los valores por defecto visuales no se derivan del ejemplo, a diferencia de los de texto**
- Dónde: los acentos están en `src/kernel/faces.ts:15-25`, las etiquetas de mundo en `src/kernel/worlds.ts:14-21` y ambos se repiten en `public/content/visual.example.json`.
- Problema: ADR 005 dice «one set of defaults derived from the example». Ningún test comprueba que las tres fuentes coincidan; si divergen, el sitio parpadea entre el valor incrustado y el ejemplo cargado.
- Recomendación: importar `visual.example.json` en el kernel, como se hace con `site.example.*.json`.

**B-13: «tokens.css holds every colour, type role, spacing value» (spec §12 P2b) no es cierto en el código**
- Evidencia: hay unos 230 valores arbitrarios de Tailwind en los componentes DOM: FaceRails 105, DetailDialog 40, FaceStrip 39. De ellos, 40 son tamaños, tracking o interlineado tipográfico (`text-[0.62rem]`, `tracking-[0.3em]`, `text-[clamp(2.2rem,4vw,4rem)]`…). `DetailDialog.tsx:105-151` no usa ningún rol tipográfico del tema. Cinco tokens de color no se usan: `obsidian-900`, `obsidian-800`, `ice-100`, `mineral-500` y `copper-400`. `docs/visual-direction.md:184` recomienda un token `glass-line` que no existe.
- Recomendación: pasar a tokens los roles que se repiten, como los del diálogo y los ajustes `narrow:`; corregir la frase del spec y la lista de `visual-direction.md`; borrar los tokens muertos o justificarlos.

**B-14: hay documentación vieja o contradictoria que un desarrollador va a leer**
- `docs/roadmap.md:101-102` todavía lista como deuda vigente «one feature folder, hand-written CSS, duplicated breakpoints, no error boundary», todo ya resuelto. `:109` describe el `SyntaxError` de los loaders, arreglado en P1 (`loadContent.ts:21-25`). `:86` describe `ci.yml` como «lint, test, build, cdk synth».
- `specs/README.md:11` recomienda `008-admin-hardening`, que contradice spec §12 («replaced by the Cognito admin after the release»). `:24` cita `src/features/premium-cube/content/` y da por abierto el `privacy:check`. `:25` da spec 003 por «fully open», aunque spec 010 la sustituye en tokens y Playwright (A-19).
- `docs/deploy-aws.md:23-24` describe el CI como «lint/test/build + cdk synth», y `:61` habla de «RDS/Aurora … Fargate», contra ADR 004 («No database in the cloud»).
- ADR 003 (`:19`) remite a `cubeSections.ts`, que ya no existe. Como los ADR son de solo añadir, basta una nota de «ver ADR 005».
- Recomendación: un commit `docs:` que alinee estos cuatro documentos.

### Severidad baja

**B-15: hay comentarios que contradicen el código**
- `vector-worlds/registry.ts:6-10` remite a `./catalog`, que ya no existe (ahora es `@/kernel/worlds`).
- `renderSeo.ts:7-9` dice que el módulo de contenido «touches `window`» (ya no es así), y `:160` dice que la clase `js` se pone en `index.html` (ahora la pone `/js-flag.js`).
- `sanitizeRichText.ts:4-5` habla de «future Node admin (Etapa 3)» y de reutilizar DOMPurify en el servidor, contra ADR 005.
- `dev/openWorldShowcase.ts:9` busca `.detail-modal`, que ya no existe.
- `infra/lib/static-site-stack.ts:73` dice «SPA client-side routing», pero no hay rutas.
- `faces.ts:8-24` mezcla «(PoC)», «Recovered from an earlier iteration» y comentarios en español; `vite.config.ts:70-74` también está en español.
- `check-layout.mjs:12` dice «8 viewports», pero son 9.
- `visualContent.ts:10` dice «the future admin panel», pero ya existe.

**B-16: hay nombres heredados en los ganchos CSS**
- Ejemplos: `side-panels*` (FaceRails), `cube-section-nav` (FaceStrip), `prototype-shell` y `prototype-chrome` (Experience e IdentityChrome), `detail-modal-title` (`DetailDialog.tsx:86`), y los tipos `CubeSection*` frente al vocabulario «face» de los componentes y eventos.
- Recomendación: renombrarlos en un solo commit mecánico; los usan `intro.css` y `check-layout.mjs`.

**B-17: la tipografía no sigue del todo ADR 006**
- No hay `<link rel="preload" as="font">`: en `dist/index.html` solo hay hojas de estilo.
- Se empaquetan los 7 subconjuntos de Inter, aunque el navegador solo descarga los que usa.
- Faltan los «metric overrides», cosa que sí está documentada.
- Recomendación: precargar el woff2 latino, o registrar en spec §12 que se descartó.

**B-18: el trinquete de presupuesto puede subir hasta un 1 % por cada `--update`**
- Dónde: `check-budget.mjs:188`.
- Recomendación: `Math.min(budget.limitBytes, Math.ceil(total * 1.01))`.

**B-19: `check:docs` exime cualquier línea con `<`, «limit», «budget» o «under»**
- Recomendación: exigir que el límite esté junto a la cifra.

**B-20: hay duplicaciones pequeñas**
- `FaceRails.tsx:129` usa `slice(0, 4)`, que repite `layoutBudgets.json` (`researchConcepts.max`).
- El mapa de RESEARCH solo se pinta si la cara tiene `features` (`FaceRails.tsx:122-123`).
- Los acentos `#b8aeff` y `#c08b5a` están a la vez en `faces.ts` y en `tokens.css` (`violet-300`, `copper-400`).
- `SectionIdSchema` se define dos veces.

**B-21: los tests y los scripts no pasan por el compilador de tipos**
- `tsconfig.app.json` excluye `*.test.ts`, y `scripts/` no está en ningún `tsconfig`; Vitest no comprueba tipos.

**B-22: el plugin de SEO no valida con el kernel**
- `vite.config.ts:33-44` solo comprueba tres campos. Un `site.en.json` inválido produciría HTML estático con datos que el runtime rechaza, y el runtime mostraría el ejemplo.

**B-23: el fallback de layout es parcial y la línea base sigue sin fijar**
- «Fixed chrome never overlaps» solo se comprueba para los CTA en modo `stacked` (`check-layout.mjs:137-144`); el bloque de identidad y el selector de idioma no se miden.
- La línea base de A-16 sigue en futuro: spec `:11` dice «Once that work is committed, the baseline is pinned…» y §12 no registra el commit.

## 4. Estado de audit-1

| Id | Estado | Nota |
|---|---|---|
| A-01 | Resuelto | P2 se partió; después D-4 (b) puso P2b–P4 antes de publicar (ADR 007) |
| A-02 | Resuelto | Inter servida, fixture de estrés, chequeo con contenido privado en local (modo `built`), red de seguridad (`max-h` y CTA `sticky`); falta la precarga (B-17) |
| A-03 | Parcial | Boundaries, `hasWebGL`, póster y `assets/` sin borrar están hechos; CloudFront sigue reescribiendo 403/404 a 200 (`static-site-stack.ts:74-77`), aplazado y documentado para la etapa de publicación |
| A-04 | Resuelto | `--exclude "content/*"`; el test tiene un hueco con `cp` y `rm` (B-08) |
| A-05 | Resuelto | El acento es una variable en tiempo de ejecución (`accent-scope`); los valores por defecto duplicados quedan en B-12 |
| A-06 | Resuelto | Una sola fuente, variantes en forma de bloque, complemento exacto probado; hay nueve variantes (B-10) |
| A-07 | Resuelto | `tsc` del kernel sin DOM; hueco con `import()` (B-06) |
| A-08 | Resuelto | Servidor con lint y tipos en verde |
| A-09 | Resuelto | Sin workspaces; `infra/` aparte |
| A-10 | Parcial | Aserciones por modo, matriz PR y nocturna, SwiftShader; el contraste contra el token del scrim no se implementó (B-02) |
| A-11 | Resuelto | `useSyncExternalStore`; límite de 250 líneas con script (no cubre `dev`) |
| A-12 | Parcial | axe, `aria-label` en el diccionario y `<dialog>` nativo están hechos; axe no evalúa contraste y nunca analiza el diálogo (B-02) |
| A-13 | Parcial | `ls-files` + lista de denegación + autores y mensajes; el contenido del historial no se escanea (B-07); procedencia de activos con test |
| A-14 | Resuelto (sitio) | Sin código inline, así que no hacen falta hashes; report-only en CloudFront y aplicada en preview; la política del admin espera a ADR 004 |
| A-15 | Parcial | Alias, `../` prohibido y regla `ImportExpression`; no cubre `content`, `dev` ni `kernel` (B-06) |
| A-16 | Parcial | El spec nunca registró el commit de la línea base (`spec.md:11`) |
| A-17 | Resuelto | §1 remite a D-5 |
| A-18 | Resuelto | Primera vista con JS, CSS, fuente y foto; deriva menor del trinquete (B-18) |
| A-19 | Resuelto | 2048×1152 en la matriz y `visual-direction.md` actualizado; `specs/README.md` sigue viejo (B-14) |
| A-20 | Resuelto | D-3 decidida, prioridad declarada, `audio/` y `dev/` en el mapa, SEO en el kernel |
| A-21 | Resuelto (como recomendación) | D-2 (c) sigue abierta para la etapa de publicación |
| A-22 | Parcial | H-11 tiene script; hay reglas de `AGENTS.md` sin barrera ni etiqueta «unchecked»: contraste AA, capa y comentario del CSS, textos a mano, deploy después de las barreras |
| A-23 | Parcial | `ctaPrimary`, `ctaSecondary` y `detail.links` se validan; `links[]` y `cta`, que son heredados y se renderizan, no (B-11) |

Elementos E del spec:

- **Resueltos y vigentes en el código:** E-01 a E-03, E-05 a E-10, E-12 a E-14, E-16, E-18 y E-19.
- **Parciales:** E-04 (literales en `public/seo-fallback.css`, fuera del escaneo), E-15 (no quedan cifras sin fecha, pero sí hechos viejos, B-14) y E-17 (falta la parte de CloudFront).
- **Abiertos por diseño en etapas posteriores:** E-11 (sin workspaces), E-20 (historial, D-5), E-21 (dos licencias, etapa de contenido) y E-22 (la barrera aún no lo detectaría, B-07).

## 5. Resultados de las barreras

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0, sin mensajes |
| `npx tsc -b` | exit 0 |
| `npm run typecheck:server` | exit 0 |
| `npm test` | 15 archivos, 82 tests pasan (2,1 s) |
| `npm run build` | exit 0; `[seo] index.html rendered from public/content/site.en.json` (contenido privado local); `index-*.js` 1.253 KB / 352 KB gzip, con el aviso de Vite de chunk > 500 KB |
| `npm run check:budget` | Primera vista 534,8 KB gzip (límite 540,0 KB); exit 0 |
| `npm run check:privacy` | «0 findings in 176 files (3 private values)»; exit 0 |
| `npm run check:docs` | «0 undated measurements in 11 living documents»; exit 0 |
| `npm run check:tokens` | «0 problems»; exit 0 |
| `node scripts/check-layout.mjs` (matriz PR, contenido del build) | 6 páginas con 0 fallos de layout y 0 de axe; `degradation: 0 failures`; `behaviour: 0 failures`; passed; 44 s |
| `node scripts/check-layout.mjs --content=stress` | passed; 5 avisos `rail-left-scrolls` en 1600×725; 31 s |
| Extra: `--full --content=example` | 18 páginas con 0 fallos; passed |
| Extra: `--full --content=stress` | passed; avisos de scroll en 1600×725 y 1280×720, ya documentados |

Sondas temporales, todas revertidas:

- Archivos de prueba `zz*` en `src/kernel`, `src/features/{faces,dev}`, `scripts/checks` y la raíz.
- Ediciones con copia previa de `FaceRails.css`, `RotateHint.tsx`, `README.md` y `deploy.yml`.
- Inyecciones en `dist/js-flag.js` y `dist/seo-fallback.css`, restauradas y verificadas con `cmp` contra `public/`.
- Al final, `git status` y `git diff` están vacíos.

**Incidencia propia:** al limpiar la salida de una sonda borré `layout-report/`. Es ignorada por git y ya existía, del 12-10 a las 20:56. Es la evidencia que deja `check:layout` cuando falla y se regenera en el siguiente fallo; no estaba versionada.

## 6. Lo que está bien

- El mapa de módulos y la tabla de dependencias coinciden con los imports reales, y la escena y el DOM solo se encuentran en `features/experience`. El reductor es puro y tiene tests, incluido el caso de volver a la misma cara.
- El kernel compila sin DOM, el servidor solo importa el kernel y el texto de la interfaz está centralizado y probado en ambos idiomas.
- Las barreras de layout, CSP y degradación fallan de verdad, cosa que comprobé con sondas. La matriz completa pasa con contenido de estrés en ambos idiomas.
- El `<dialog>` es nativo y conserva el contrato de foco probado. Ya no hay `App.css`, y el CSS escrito a mano que queda es poco, está comentado y vive en `@layer components`.
- No hay código de desarrollo en el bundle de producción. El deploy no borra `content/` y la primera vista bajó a 535 KB gzip.
- El spec §12 registra con honestidad las desviaciones (P2a sin WebGL, `desktop-short` a 900 px, el `localeChanged` descartado). Los hallazgos de arriba son sobre todo huecos de las barreras y restos heredados, no una arquitectura distinta de la declarada.
