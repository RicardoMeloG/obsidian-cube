# Auditoría de desvío 1: después de S2 (el escenario lee el contenido)

Hecha el 2026-10-15 sobre la rama `concept/escenario`, con los cambios de S2 todavía sin commit (base `af638dc`). Es el primer punto de control que fija la sección 5 de la spec: hay que resolverla antes de empezar S3.

## Método

Dos auditores locales sin contexto previo, cada uno por separado: `qwen3.6:27b` (con razonamiento) y `gemma4:31b`. Cada uno recibió las reglas declaradas y el código de S2 en tres partes:

- **Reglas:** `AGENTS.md` (Experience Architecture, Hard Rules, Architecture Rules), las secciones 3 a 8 de esta spec y la tabla de dependencias de `docs/architecture.md`.
- **Código:**
  - `stage`: los componentes del escenario, `Experience.tsx` y `copy.ts`.
  - `kernel`: las composiciones, los iconos, los campos, el contenido, las reglas de publicación y los presupuestos.
  - `harness`: el contenido de estrés, `eslint.config.js`, el límite de tamaño, la prueba de render y el diff de `check-layout.mjs`.

La consigna fue informar solo desvíos demostrables, citando a la vez la línea de código y el texto exacto de la regla. Cada hallazgo lo verificó después Claude contra el código. El procedimiento quedó después en `scripts/audit-drift.mjs`, para repetirlo en los puntos de control siguientes.

## Hallazgos

| Id | Hallazgo | Quién | Veredicto | Resolución |
|---|---|---|---|---|
| F-1 | `StageTop.tsx:44` y `:50` escriben `GitHub` y `LinkedIn` en el marcado, mientras «Correo» sale de `copy.ts`. Contradice AD-07 («the stage also writes no text in its markup»). | ambos | **Confirmado.** Además muestra que la regla `STAGE_TEXT` deja pasar las palabras sueltas. | `copy.githubLink` y `copy.linkedinLink` en `copy.ts`. No queda texto de una palabra escrito en el marcado del escenario (búsqueda en `src/features/stage`). |
| F-2 | La barrera de la sección 4 dice «may not export string literals longer than one word outside `copy.ts`», pero la regla aplicada solo mira el texto de JSX y cuatro atributos. | qwen | **Confirmado**: la spec prometía más de lo que se aplica. | La spec describe ahora lo que se aplica. Las palabras sueltas en el marcado y las cadenas guardadas en constantes quedan marcadas **unchecked**: una regla sobre todo literal atraparía también los nombres de clase. |
| F-3 | `stressContent.mjs:89` escribe un nombre de dueño. | gemma | **Rechazado.** Es el fixture de estrés de las barreras, no contenido del escenario; la regla citada habla de `features/stage`. | — |

Sin hallazgos en el kernel (ninguno de los dos modelos).

## Lo que no cubrió

Los auditores leyeron código y reglas; no ejecutaron nada. Lo que vale en tiempo de ejecución lo cubren las barreras de S2, todas en verde al cerrar este registro:

- **Geometría:** el chequeo de layout pasa con contenido de estrés en la matriz completa, con el contenido de ejemplo en la matriz completa y con el contenido construido, incluidas degradación y comportamiento.
- **Recorrido visual** (`scripts/walkthrough.mjs`): escenario a 1440×900 y 1366×768 en los dos idiomas, rieles con `?layout=rails`, rieles en 390×844. Sin errores de página.

La excepción conocida es el peso de la primera vista, que ya superaba el presupuesto antes de esta etapa (E-05). Se resuelve en S6.
