# Cómo construyo con agentes

Este sitio es mi caso de estudio. Lo construyo con agentes de IA: Claude Code escribe el código, y Codex me apoya en revisiones de diseño y conceptos visuales. Las decisiones quedan escritas en su repositorio público: {{specs}} specs, {{adrs}} decisiones de arquitectura y {{audits}} auditorías registradas. Esta página resume el método y enlaza la evidencia.

## El ciclo

{{figure:loop}}

Un cambio grande recorre siete pasos ([la regla, en AGENTS.md](../../AGENTS.md)):

1. **Spec.** Antes del código, un documento con el problema, el resultado esperado, lo que queda fuera, las decisiones abiertas y cómo se acepta. Ejemplo: [la spec de las pruebas proporcionales](../../specs/012-proportional-gates/spec.md).
2. **Auditoría sin contexto.** Un agente que no participó lee el trabajo, lo contrasta con el código y con las reglas escritas, y lo juzga contra el objetivo del proyecto. Sus hallazgos quedan registrados junto a la spec: [primera auditoría de la arquitectura](../../specs/010-architecture/audit-1.md).
3. **Revisión.** Cada hallazgo se verifica. Los que se confirman se corrigen o se registran como deuda, y los que no se responden por escrito, porque una auditoría es una recomendación y no una orden.
4. **Construcción.** Los agentes trabajan dentro de un contrato, [AGENTS.md](../../AGENTS.md), que leen antes de cada cambio: límites de arquitectura, reglas de diseño y privacidad.
5. **Pruebas.** Antes de cada push corren la prueba de privacidad y la de la regla proporcional (secretos, archivos ignorados, el registro de una auditoría del diff de código y el nombre de la spec). En CI corren los tipos, los tests, el diseño en los tamaños de pantalla de referencia, el peso de la primera vista y los colores ([la lista](../../docs/architecture.md)). Después de publicar se corre a mano una prueba del sitio en vivo.
6. **Una persona mira.** Las pruebas en verde no son la experiencia. Cada etapa cierra con un recorrido visual que hago yo. Es una regla de trabajo, no una prueba automática.
7. **Commit con nombre.** En un cambio grande, el commit debe nombrar su spec o su decisión, y la prueba de antes del push lo exige. Así se puede rastrear el porqué de cada cambio grande.

## Proceso proporcional

No todo cambio merece el ciclo completo. Las rutas que toca un push deciden el nivel, no quién lo sube ([la regla](../../scripts/lib/push-gate.mjs)):

- **Ajuste** (documentación, ejemplos): se revisa al terminar.
- **Cambio** (código): además, una auditoría del diff exacto antes del push.
- **Cambio grande** (el contrato, el núcleo del sitio, la infraestructura, las propias pruebas): el ciclo completo.

Las pruebas también se protegen a sí mismas: subir un límite de peso o marcar una falla como conocida es un cambio grande ([spec 021](../../specs/021-gate-coverage/spec.md)).

## Dónde decide una persona

- **Producción.** Los agentes pueden lanzar un despliegue del código, pero el entorno de producción espera mi aprobación en GitHub y nadie más puede darla. El contenido y la infraestructura se publican desde mi equipo, con una sesión de AWS que inicio yo ([el procedimiento](../../docs/deploy-aws.md)). Además, como regla de trabajo, agrupo varios cambios en cada despliegue.
- **Credenciales, condiciones y pagos.** Ningún agente escribe una contraseña, acepta términos ni paga: esos pasos los hago yo. Es una regla de trabajo.
- **Dirección del producto.** Los agentes proponen alternativas con evidencia, y la decisión queda escrita con quién la tomó y cuándo ([las decisiones](../../docs/decisions/)).

## Lo que salió mal

El método no evita los errores. Deja escrito cómo se encontró cada uno y cómo se corrigió; algunos ya estaban en producción.

1. **Un freno que confiaba en el visitante.** El receptor de partidas limitaba los envíos por IP leyendo una cabecera que el cliente puede falsificar. Una prueba de disparo después del despliegue lo mostró: la cabecera llegaba como la mandaba el cliente, así que cada envío podía declarar otra IP. Ahora la IP la escribe el borde de la red y el cliente no puede reemplazarla: en la misma prueba, después de corregirlo, el undécimo envío fue rechazado ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/a916c24)).
2. **La raíz como listado del bucket.** Una auditoría sospechó de un permiso de listado. Al verificarlo, el problema real era otro: una ruta `//` llegaba al origen como `/`, que es un listado. Se corrigió en la función del borde ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/871542f)).
3. **Un token disponible al compilar.** Una reauditoría notó que el paso de compilación conservaba el permiso para pedir a GitHub un token de acceso a AWS, así que un complemento de la compilación podía obtenerlo. Ahora compilar y desplegar son trabajos separados, y el primero no tiene ese permiso ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/f5777fa)).
4. **Una dirección de correo en una spec.** La prueba de privacidad rechaza cualquier dirección de correo en el repositorio, y una spec la tenía. Ahora nombra el contacto sin escribirlo ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/68f62fa)).
5. **Un tono que no se leía.** La medición del sitio en producción encontró un gris con contraste 4,2:1 en textos pequeños, bajo el mínimo AA. Pasó a 5,2:1 ([corrección](https://github.com/RicardoMeloG/obsidian-cube/commit/cf1151f)).

## Lo que esto no prueba

- Las auditorías las hacen modelos de IA sin contexto previo, no una firma externa.
- Las pruebas en verde dicen que se cumplen las reglas escritas, no que esas reglas basten.
- El trabajo pendiente y sus prioridades viven en un panel privado, no en el repositorio.
- El registro no es perfecto: dos specs (009 y 016) no tienen auditoría archivada, y yo puedo saltar la prueba de antes del push, con el motivo en el commit siguiente.
- La aprobación de producción se configura en GitHub, no en el repositorio.
- Es el método de una persona con agentes, no el de un equipo grande.

## Para revisar

- [El repositorio](https://github.com/RicardoMeloG/obsidian-cube) y su [índice de specs](../../specs/README.md).
- [Iron Bastion](https://github.com/RicardoMeloG/iron-bastion), un juego hecho con el mismo enfoque, con su propio [AGENTS.md](https://github.com/RicardoMeloG/iron-bastion/blob/main/AGENTS.md).
