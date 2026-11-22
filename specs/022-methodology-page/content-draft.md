# 022: Draft of the Methodology Page

Written by Claude for the owner to correct (spec 022, stage 1). It was revised after `audit-1.md`: each claim now says where it is enforced, or that it is a working rule. Spanish comes first, as the owner's language; the English follows the same structure.

- `{{specs}}`, `{{audits}}` and `{{adrs}}` are counted when the site is built.
- `{{figure:loop}}` is the diagram.
- Links are relative to the repository and become GitHub links.

---

## Español

# Cómo construyo con agentes

Este sitio es mi caso de estudio. Lo construyo con agentes de IA: Claude Code escribe el código, y Codex me apoya en revisiones de diseño y conceptos visuales. Cada decisión queda escrita en su repositorio público: {{specs}} specs, {{adrs}} decisiones de arquitectura y {{audits}} auditorías registradas. Esta página resume el método y enlaza la evidencia.

## El ciclo

{{figure:loop}}

Un cambio grande recorre siete pasos ([la regla, en AGENTS.md](AGENTS.md)):

1. **Spec.** Antes del código, un documento con el problema, el resultado esperado, lo que queda fuera, las decisiones abiertas y cómo se acepta. Ejemplo: [la spec de las pruebas proporcionales](specs/012-proportional-gates/spec.md).
2. **Auditoría sin contexto.** Un agente que no participó lee el trabajo y lo juzga contra su objetivo, no contra el código. Sus hallazgos quedan registrados junto a la spec: [primera auditoría de la arquitectura](specs/010-architecture/audit-1.md).
3. **Revisión.** Cada hallazgo se verifica. Los que se confirman se corrigen y los que no se responden por escrito, porque una auditoría es una recomendación y no una orden.
4. **Construcción.** Los agentes trabajan dentro de un contrato, [AGENTS.md](AGENTS.md), que leen antes de cada cambio: límites de arquitectura, reglas de diseño y privacidad.
5. **Pruebas.** Antes de cada push corren la prueba de privacidad y la de la regla proporcional (secretos, archivos ignorados, la auditoría del diff de código y el nombre de la spec). En CI corren los tipos, los tests, el diseño en cada tamaño de pantalla, el peso de la primera vista y los colores ([la lista](docs/architecture.md)). Después de publicar se revisa el sitio en vivo.
6. **Una persona mira.** Las pruebas en verde no son la experiencia. Cada etapa cierra con un recorrido visual que hago yo. Es una regla de trabajo, no una prueba automática.
7. **Commit con nombre.** En un cambio grande, el commit debe nombrar su spec o su decisión, y la prueba de antes del push lo exige. Así se puede rastrear el porqué de cada cambio grande.

## Proceso proporcional

No todo cambio merece el ciclo completo. Las rutas que toca un push deciden el nivel, no quién lo sube ([la regla](scripts/lib/push-gate.mjs)):

- **Ajuste** (documentación, ejemplos): se revisa al terminar.
- **Cambio** (código): además, una auditoría del diff exacto antes del push.
- **Cambio grande** (el contrato, la infraestructura, las propias pruebas): el ciclo completo.

Las pruebas también se protegen a sí mismas: subir un límite de peso o marcar una falla como conocida es un cambio grande ([spec 021](specs/021-gate-coverage/spec.md)).

## Dónde decide una persona

- **Producción.** Los agentes pueden lanzar un despliegue, pero el entorno de producción espera mi aprobación en GitHub y nadie más puede darla ([el procedimiento](docs/deploy-aws.md)). Además, como regla de trabajo, agrupo varios cambios en cada despliegue.
- **Credenciales, condiciones y pagos.** Ningún agente escribe una contraseña, acepta términos ni paga: esos pasos los hago yo. Es una regla de trabajo.
- **Dirección del producto.** Los agentes proponen alternativas con evidencia, y la decisión queda escrita con quién la tomó y cuándo ([las decisiones](docs/decisions/)).

## Lo que salió mal

El método no evita los errores, pero los encuentra antes de que lleguen a alguien.

1. **Un freno que confiaba en el visitante.** El receptor de partidas limitaba los envíos por IP leyendo una cabecera que el cliente puede falsificar. Una prueba de disparo después del despliegue lo mostró: diez envíos con IP inventadas pasaron. Ahora la IP la escribe el borde de la red y el cliente no puede reemplazarla ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/a916c24)).
2. **La raíz como listado del bucket.** Una auditoría sospechó de un permiso de listado. Al verificarlo, el problema real era otro: una ruta `//` llegaba al origen como `/`, que es un listado. Se corrigió en la función del borde ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/871542f)).
3. **Un token disponible al compilar.** Una reauditoría notó que el paso de compilación conservaba el permiso para pedir a GitHub un token de acceso a AWS, así que un complemento de la compilación podía obtenerlo. Ahora compilar y desplegar son trabajos separados, y el primero no tiene ese permiso ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/f5777fa)).
4. **Una dirección de correo en una spec.** La prueba de privacidad rechaza cualquier dirección de correo en el repositorio, y una spec la tenía. Ahora nombra el contacto sin escribirlo ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/68f62fa)).
5. **Un tono que no se leía.** La medición del sitio en producción encontró un gris con contraste 4,2:1 en textos pequeños, bajo el mínimo AA. Pasó a 5,2:1 ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/cf1151f)).

## Lo que esto no prueba

- Las auditorías las hacen modelos de IA sin contexto previo, no una firma externa.
- Las pruebas en verde dicen que se cumplen las reglas escritas, no que esas reglas basten.
- El registro no es perfecto: dos specs tempranas no tienen auditoría archivada, y yo puedo saltar la prueba de antes del push, con el motivo en el commit siguiente.
- La aprobación de producción se configura en GitHub, no en el repositorio.
- Es el método de una persona con agentes, no el de un equipo grande.

## Para revisar

- [El repositorio](https://github.com/RicardoMeloG/obsidian-cube) y su [índice de specs](specs/README.md).
- [Iron Bastion](https://github.com/RicardoMeloG/iron-bastion), un juego hecho con el mismo enfoque, con su propio [AGENTS.md](https://github.com/RicardoMeloG/iron-bastion/blob/main/AGENTS.md).

---

## English

# How I Build with Agents

This site is my case study. I build it with AI agents: Claude Code writes the code, and Codex helps with design reviews and visual concepts. Every decision is written down in its public repository: {{specs}} specs, {{adrs}} architecture decisions and {{audits}} recorded audits. This page sums up the method and links the evidence.

## The loop

{{figure:loop}}

A large change goes through seven steps ([the rule, in AGENTS.md](AGENTS.md)):

1. **Spec.** Before the code, a document with the problem, the expected outcome, what stays out, the open decisions and how it is accepted. Example: [the spec of the proportional gates](specs/012-proportional-gates/spec.md).
2. **Audit without context.** An agent that took no part reads the work and judges it against its goal, not against the code. Its findings are recorded next to the spec: [the architecture's first audit](specs/010-architecture/audit-1.md).
3. **Revision.** Every finding is verified. Confirmed ones are fixed and the rest are answered in writing, because an audit is a recommendation, not an order.
4. **Build.** The agents work inside a contract, [AGENTS.md](AGENTS.md), which they read before every change: architecture limits, design rules and privacy.
5. **Gates.** Before every push, the privacy check and the proportional gate run: secrets, ignored files, the audit of the code diff and the spec's name. In CI, types, tests, layout at every screen size, first-view weight and colours run ([the list](docs/architecture.md)). After a deploy, the live site is checked.
6. **A person looks.** Green checks are not the experience. Every stage closes with a visual walk-through that I do. This is a working rule, not an automated check.
7. **A commit that names its reason.** In a large change, the commit must name its spec or decision, and the pre-push gate requires it. That way every large change can be traced to its why.

## Proportional process

Not every change deserves the full loop. The paths a push touches decide the level, not who pushes it ([the rule](scripts/lib/push-gate.mjs)):

- **Adjustment** (documentation, examples): reviewed when done.
- **Change** (code): also an audit of the exact diff before the push.
- **Large change** (the contract, the infrastructure, the gates themselves): the full loop.

The gates also guard themselves: raising a weight limit or marking a failure as known is a large change ([spec 021](specs/021-gate-coverage/spec.md)).

## Where a person decides

- **Production.** Agents can start a deploy, but the production environment waits for my approval in GitHub, and nobody else may give it ([the procedure](docs/deploy-aws.md)). As a working rule, I also group several changes into each deploy.
- **Credentials, terms and payments.** No agent types a password, accepts terms or pays: those steps are mine. This is a working rule.
- **Product direction.** Agents propose options with evidence, and the decision is written down with who took it and when ([the decisions](docs/decisions/)).

## What went wrong

The method does not prevent mistakes, but it finds them before they reach anyone.

1. **A brake that trusted the visitor.** The match-log receiver limited writes per IP by reading a header the client can forge. A trip test after the deploy showed it: ten writes with made-up addresses passed. Now the edge writes the address, and a client cannot replace it ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/a916c24)).
2. **The root as a bucket listing.** An audit suspected a listing permission. Checking it showed the real gap was elsewhere: a `//` path reached the origin as `/`, which is a listing. The edge function now fixes it ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/871542f)).
3. **A token within reach of the build.** A re-audit noticed the build job kept the permission to ask GitHub for an AWS access token, so a build plugin could have obtained one. Building and deploying are now separate jobs, and the first lacks that permission ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/f5777fa)).
4. **An e-mail address in a spec.** The privacy check refuses any e-mail address in the repository, and a spec had one. It now names the contact without writing it ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/68f62fa)).
5. **A tone that could not be read.** Measuring the live site found a grey at 4.2:1 contrast on small text, under the AA minimum. It is now 5.2:1 ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/cf1151f)).

## What this does not prove

- The audits are done by AI models without prior context, not by an outside firm.
- Green checks say the written rules hold, not that the rules are enough.
- The record is not perfect: two early specs have no audit on file, and I can skip the pre-push gate, with the reason in the next commit.
- The production approval is configured in GitHub, not in the repository.
- It is one person's method with agents, not a large team's.

## To inspect

- [The repository](https://github.com/RicardoMeloG/obsidian-cube) and its [index of specs](specs/README.md).
- [Iron Bastion](https://github.com/RicardoMeloG/iron-bastion), a game built the same way, with its own [AGENTS.md](https://github.com/RicardoMeloG/iron-bastion/blob/main/AGENTS.md).
