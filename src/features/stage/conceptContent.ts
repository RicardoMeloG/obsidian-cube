import type { FaceId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'

// Content of the stage concept (`?layout=escenario`). It lives here, not in
// the content documents, because each face has its own shape and the kernel
// has no schema for them yet (a future spec 011). Text marked as example in
// the concept notes is filler to judge the design, not a claim.

export type IconId =
  | 'sparkles'
  | 'box'
  | 'database'
  | 'shield'
  | 'book'
  | 'mail'
  | 'file'
  | 'send'
  | 'check'
  | 'package'
  | 'branch'
  | 'factory'
  | 'alert'
  | 'trend'
  | 'key'
  | 'scale'
  | 'gauge'
  | 'lightbulb'
  | 'split'

export type Chip = string

export type AgenticFace = {
  kind: 'agentic'
  eyebrow: string
  title: [string, string]
  summary: string
  featured: { label: string; title: string; text: string; chips: Chip[] }
  modelTitle: string
  model: { icon: IconId; label: string; text: string }[]
  proofsTitle: string
  proofsTrail: string
  proofs: { icon: IconId; kind: string; title: string; text: string; chips: Chip[] }[]
  primary: string
  secondary: string
}

export type Product = {
  id: string
  name: string
  meta: string
  status: string
  text: string
  chips: Chip[]
  image: string
  thumb: string
  facts: { icon: IconId; label: string; text: string }[]
}

export type ProductsFace = {
  kind: 'products'
  eyebrow: string
  title: [string, string]
  summary: string
  listTitle: string
  products: Product[]
  primary: string
  secondary: string
}

export type SystemsFace = {
  kind: 'systems'
  eyebrow: string
  title: [string, string]
  summary: string
  caseLabel: string
  caseName: string
  before: { title: string; items: string[] }
  after: { title: string; items: string[] }
  mapTitle: string
  mapNote: string
  legend: { migrated: string; active: string; pending: string }
  modules: ('migrated' | 'active' | 'pending')[]
  steps: { icon: IconId; label: string; text: string }[]
  primary: string
}

export type SecurityFace = {
  kind: 'security'
  eyebrow: string
  title: [string, string]
  summary: string
  boundary: { label: string; text: string }
  decision: { label: string; title: string; text: string }
  consoleTitle: string
  command: string
  controls: { status: 'implemented' | 'verified' | 'planned'; id: string; text: string }[]
  statusLabels: Record<'implemented' | 'verified' | 'planned', string>
  tally: string
  primary: string
}

export type ResearchFace = {
  kind: 'research'
  eyebrow: string
  title: [string, string]
  summary: string
  questionLabel: string
  question: string
  chain: { icon: IconId; label: string; text: string }[]
  distinctionsTitle: string
  distinctions: { term: string; text: string }[]
  notes: { label: string; title: string; meta: string }
  primary: string
}

export type ContactFace = {
  kind: 'contact'
  eyebrow: string
  title: [string, string]
  summary: string
  availability: string
  channels: { id: 'email' | 'github' | 'linkedin'; label: string; text: string }[]
  form: {
    title: string
    text: string
    fields: { name: string; company: string; email: string }
    human: string
    submit: string
    note: string
    sent: string
  }
}

export type StageFace = AgenticFace | ProductsFace | SystemsFace | SecurityFace | ResearchFace | ContactFace

export type StageCopy = {
  dock: Record<FaceId, { icon: IconId; subtitle: string }>
  links: { email: string; github: string; linkedin: string }
  explore: string
  exploreBack: string
  exploreHint: string
  counter: (index: number, total: number) => string
  faces: Record<FaceId, StageFace>
}

const ES: StageCopy = {
  dock: {
    agentic: { icon: 'sparkles', subtitle: 'Construyo con agentes' },
    products: { icon: 'box', subtitle: 'Herramientas reales' },
    systems: { icon: 'database', subtitle: 'Sistemas en producción' },
    security: { icon: 'shield', subtitle: 'Seguridad por diseño' },
    research: { icon: 'book', subtitle: 'Investigación propia' },
    contact: { icon: 'mail', subtitle: 'Hablemos' },
  },
  links: { email: 'Correo', github: 'GitHub', linkedin: 'LinkedIn' },
  explore: 'Explorar el cubo',
  exploreBack: 'Volver al contenido',
  exploreHint: 'Arrastra para girar · haz clic en una cara para abrirla · Esc para volver',
  counter: (index, total) => `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
  faces: {
    agentic: {
      kind: 'agentic',
      eyebrow: 'Trabajo agéntico',
      title: ['Construyo con', 'agentes de IA'],
      summary: 'Diseño, orquesto y valido agentes para construir software real, con decisiones registradas y resultados verificables.',
      featured: {
        label: 'Caso en vivo',
        title: 'Este portafolio — Obsidian Cube',
        text: 'Hecho con agentes a partir de especificaciones, decisiones documentadas y puertas de calidad en cada cambio.',
        chips: ['React', 'Three.js', 'TypeScript', 'Specs'],
      },
      modelTitle: 'Modelo operativo',
      model: [
        { icon: 'file', label: 'Especificar', text: 'Objetivo, contexto y límites en una spec verificable.' },
        { icon: 'send', label: 'Delegar', text: 'Agentes con herramientas acotadas y reglas explícitas.' },
        { icon: 'check', label: 'Revisar', text: 'Pruebas, chequeos y revisión humana antes de aceptar.' },
        { icon: 'package', label: 'Entregar', text: 'Lo validado llega a producción y se mantiene.' },
      ],
      proofsTitle: 'Evidencia inspeccionable',
      proofsTrail: 'Spec → ADR → CI',
      proofs: [
        { icon: 'file', kind: 'Especificación', title: 'Specs del portafolio', text: 'Objetivo, alcance y restricciones de este sitio.', chips: ['Markdown', 'Specs'] },
        { icon: 'split', kind: 'Decisión (ADR)', title: 'Registro de decisiones', text: 'Por qué cada decisión, con alternativas y costos.', chips: ['ADR', 'Arquitectura'] },
        { icon: 'gauge', kind: 'Puerta de calidad', title: 'Chequeos en cada build', text: 'Fronteras, 91 pruebas, layout y presupuesto de peso.', chips: ['CI', 'Playwright'] },
      ],
      primary: 'Ver el método',
      secondary: 'Leer las decisiones',
    },
    products: {
      kind: 'products',
      eyebrow: 'Productos',
      title: ['Herramientas', 'reales'],
      summary: 'Software que resuelve problemas concretos, construido con agentes y usado de verdad.',
      listTitle: 'Seleccionados',
      products: [
        {
          id: 'openmenu',
          name: 'OpenMenu GDEMU Manager',
          meta: 'Escritorio',
          status: 'Código abierto',
          text: 'Gestiona juegos y carátulas de la tarjeta SD de un emulador de lectora.',
          chips: ['Python', 'Qt', 'GDEMU'],
          image: '/concept/openmenu.webp',
          thumb: '/concept/openmenu-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problema', text: 'Ordenar juegos y carátulas en la SD era manual y propenso a errores.' },
            { icon: 'lightbulb', label: 'Mi aporte', text: 'Diseñé y construí la herramienta pensando en usuarios no técnicos.' },
            { icon: 'trend', label: 'Resultado', text: 'Menú y carátulas listos en un paso, sin editar archivos a mano.' },
          ],
        },
        {
          id: 'transcripcion',
          name: 'Transcripción local',
          meta: 'Escritorio',
          status: 'En desarrollo',
          text: 'Transcribe el audio del sistema y del micrófono en el equipo, separando hablantes.',
          chips: ['Whisper', 'Diarización', 'Local'],
          image: '/concept/transcripcion.webp',
          thumb: '/concept/transcripcion-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problema', text: 'Transcribir reuniones sin enviar el audio a terceros.' },
            { icon: 'lightbulb', label: 'Mi aporte', text: 'Captura, transcripción y separación de hablantes, todo local.' },
            { icon: 'trend', label: 'Resultado', text: 'Nada sale del equipo; exporta a Markdown y SRT.' },
          ],
        },
        {
          id: 'busqueda',
          name: 'Búsqueda agéntica',
          meta: 'Prototipo',
          status: 'Código abierto',
          text: 'Un agente que busca, lee y contrasta fuentes antes de responder.',
          chips: ['Agentes', 'RAG', 'Citas'],
          image: '/concept/busqueda.webp',
          thumb: '/concept/busqueda-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problema', text: 'Respuestas de IA sin fuentes que se puedan revisar.' },
            { icon: 'lightbulb', label: 'Mi aporte', text: 'Traza visible del agente y contraste de cada afirmación.' },
            { icon: 'trend', label: 'Resultado', text: 'Cada afirmación enlaza a la fuente que la respalda.' },
          ],
        },
        {
          id: 'panel',
          name: 'Panel operativo',
          meta: 'Web',
          status: 'Caso anonimizado',
          text: 'Órdenes de trabajo, equipos y aprobaciones de una operación industrial.',
          chips: ['Laravel', 'Dashboards'],
          image: '/concept/panel.webp',
          thumb: '/concept/panel-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problema', text: 'El estado de la operación vivía en planillas dispersas.' },
            { icon: 'lightbulb', label: 'Mi aporte', text: 'Modelo de datos, panel y flujo de aprobaciones.' },
            { icon: 'trend', label: 'Resultado', text: 'Un solo lugar para ver órdenes, equipos y pendientes.' },
          ],
        },
      ],
      primary: 'Ver repositorio',
      secondary: 'Ver detalle',
    },
    systems: {
      kind: 'systems',
      eyebrow: 'Sistemas',
      title: ['Evolucionar sistemas', 'bajo restricciones'],
      summary: 'Un sistema heredado modernizado sin detener la operación que depende de él.',
      caseLabel: 'Caso anonimizado',
      caseName: 'Modernización de un sistema heredado',
      before: { title: 'Antes', items: ['Monolito PHP con ~100 tablas', 'Despliegues manuales'] },
      after: { title: 'Después', items: ['Módulos Laravel con pruebas', 'Despliegue por módulo'] },
      mapTitle: 'Mapa de migración',
      mapNote: 'Datos ilustrativos',
      legend: { migrated: 'Migrado', active: 'En curso', pending: 'Pendiente' },
      modules: [
        'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated',
        'migrated', 'migrated', 'migrated', 'active', 'active', 'migrated', 'migrated', 'pending',
        'migrated', 'active', 'pending', 'pending', 'migrated', 'pending', 'pending', 'pending',
      ],
      steps: [
        { icon: 'factory', label: 'Contexto', text: 'Operación industrial continua; el sistema registra órdenes, equipos y aprobaciones.' },
        { icon: 'alert', label: 'Restricción', text: 'No se puede detener: cada cambio convive con el sistema en uso.' },
        { icon: 'branch', label: 'Decisión', text: 'Migración incremental a Laravel, módulo por módulo.' },
        { icon: 'trend', label: 'Resultado', text: 'Módulos nuevos con pruebas; el monolito se apaga por partes.' },
      ],
      primary: 'Leer el caso',
    },
    security: {
      kind: 'security',
      eyebrow: 'Seguridad',
      title: ['Seguridad aplicada,', 'límites explícitos'],
      summary: 'Controles que implementé, cómo se verifican y qué delego a propósito.',
      boundary: { label: 'Límite de confianza', text: 'El panel de administración es la única puerta a los datos privados.' },
      decision: {
        label: 'Decisión de arquitectura',
        title: 'Delegar la autenticación a Cognito',
        text: 'Sin login propio en producción: MFA gestionado en vez de reinventarlo.',
      },
      consoleTitle: 'Registro de controles',
      command: 'npm run check:security',
      controls: [
        { status: 'implemented', id: 'auth.mfa', text: 'Contraseña + TOTP: el admin exige segundo factor' },
        { status: 'verified', id: 'headers.csp', text: 'CSP y HSTS revisados en cada build' },
        { status: 'verified', id: 'check.privacy', text: 'Sin datos personales en código ni historial' },
        { status: 'implemented', id: 'admin.bind', text: 'El admin local solo escucha en 127.0.0.1' },
        { status: 'verified', id: 'deps.audit', text: 'Dependencias auditadas: 0 vulnerabilidades' },
        { status: 'planned', id: 'cv.ratelimit', text: 'Límite de solicitudes en el formulario de CV' },
      ],
      statusLabels: { implemented: 'Implementado', verified: 'Verificado', planned: 'Planificado' },
      tally: '6 controles · 3 verificados · 2 implementados · 1 planificado',
      primary: 'Ver el modelo de amenazas',
    },
    research: {
      kind: 'research',
      eyebrow: 'Investigación',
      title: ['Un argumento', 'abierto a refutación'],
      summary: 'Investigación independiente sobre pensamiento, verdad y representación en sistemas de IA.',
      questionLabel: 'Pregunta central',
      question: '¿Puede un sistema que solo predice texto distinguir entre lo que dice y lo que es el caso?',
      chain: [
        { icon: 'lightbulb', label: 'Tesis', text: 'Sin un modelo del mundo contra el cual contrastar, la salida es coherencia, no verdad.' },
        { icon: 'scale', label: 'Objeción más fuerte', text: 'La coherencia a gran escala podría bastar para aproximar la verdad.' },
        { icon: 'alert', label: 'Límite', text: 'El argumento no mide capacidades: delimita qué cuenta como saber.' },
      ],
      distinctionsTitle: 'Distinciones',
      distinctions: [
        { term: 'Salida vs. verdad', text: 'Lo que un modelo dice no es lo que es el caso.' },
        { term: 'Representación', text: 'Un modelo del mundo no es el mundo.' },
      ],
      notes: { label: 'Documento público', title: 'Notas de investigación', meta: '12 min de lectura' },
      primary: 'Leer el argumento',
    },
    contact: {
      kind: 'contact',
      eyebrow: 'Contacto',
      title: ['Contacto directo,', 'sin rodeos'],
      summary: 'Para roles y colaboraciones: escríbeme directo o solicita mi CV.',
      availability: 'Disponible para roles de ingeniería de producto con IA · remoto o híbrido',
      channels: [
        { id: 'email', label: 'Correo', text: 'Respondo en 24–48 h' },
        { id: 'github', label: 'GitHub', text: 'Código y proyectos públicos' },
        { id: 'linkedin', label: 'LinkedIn', text: 'Trayectoria y contexto profesional' },
      ],
      form: {
        title: 'Solicitar CV',
        text: 'Lo comparto a pedido. Una verificación rápida lo mantiene lejos de bots.',
        fields: { name: 'Nombre', company: 'Empresa', email: 'Correo laboral' },
        human: 'Soy humano',
        submit: 'Solicitar CV',
        note: 'Respondo personalmente.',
        sent: 'Concepto: el envío no está conectado.',
      },
    },
  },
}

const EN: StageCopy = {
  dock: {
    agentic: { icon: 'sparkles', subtitle: 'Building with agents' },
    products: { icon: 'box', subtitle: 'Real software tools' },
    systems: { icon: 'database', subtitle: 'Production systems' },
    security: { icon: 'shield', subtitle: 'Security by design' },
    research: { icon: 'book', subtitle: 'Independent research' },
    contact: { icon: 'mail', subtitle: 'Get in touch' },
  },
  links: { email: 'Email', github: 'GitHub', linkedin: 'LinkedIn' },
  explore: 'Explore the cube',
  exploreBack: 'Back to the content',
  exploreHint: 'Drag to rotate · click a face to open it · Esc to go back',
  counter: (index, total) => `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
  faces: {
    agentic: {
      kind: 'agentic',
      eyebrow: 'Agentic work',
      title: ['Building with', 'AI agents'],
      summary: 'I design, orchestrate and validate agents to build real software, with recorded decisions and verifiable results.',
      featured: {
        label: 'Live case',
        title: 'This portfolio — Obsidian Cube',
        text: 'Built with agents from specifications, documented decisions and quality gates on every change.',
        chips: ['React', 'Three.js', 'TypeScript', 'Specs'],
      },
      modelTitle: 'Operating model',
      model: [
        { icon: 'file', label: 'Specify', text: 'Goal, context and limits in a testable spec.' },
        { icon: 'send', label: 'Delegate', text: 'Agents with scoped tools and explicit rules.' },
        { icon: 'check', label: 'Review', text: 'Tests, checks and human review before accepting.' },
        { icon: 'package', label: 'Ship', text: 'Validated work reaches production and is maintained.' },
      ],
      proofsTitle: 'Inspectable evidence',
      proofsTrail: 'Spec → ADR → CI',
      proofs: [
        { icon: 'file', kind: 'Specification', title: 'Portfolio specs', text: 'Goal, scope and constraints of this site.', chips: ['Markdown', 'Specs'] },
        { icon: 'split', kind: 'Decision (ADR)', title: 'Decision log', text: 'Why each decision, with alternatives and costs.', chips: ['ADR', 'Architecture'] },
        { icon: 'gauge', kind: 'Quality gate', title: 'Checks on every build', text: 'Boundaries, 91 tests, layout and weight budget.', chips: ['CI', 'Playwright'] },
      ],
      primary: 'See the method',
      secondary: 'Read the decisions',
    },
    products: {
      kind: 'products',
      eyebrow: 'Products',
      title: ['Real', 'software tools'],
      summary: 'Software that solves concrete problems, built with agents and actually used.',
      listTitle: 'Selected',
      products: [
        {
          id: 'openmenu',
          name: 'OpenMenu GDEMU Manager',
          meta: 'Desktop',
          status: 'Open source',
          text: 'Manages the games and covers on the SD card of an optical-drive emulator.',
          chips: ['Python', 'Qt', 'GDEMU'],
          image: '/concept/openmenu.webp',
          thumb: '/concept/openmenu-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problem', text: 'Arranging games and covers on the SD card was manual and error-prone.' },
            { icon: 'lightbulb', label: 'My part', text: 'Designed and built the tool with non-technical users in mind.' },
            { icon: 'trend', label: 'Result', text: 'Menu and covers ready in one step, no hand-edited files.' },
          ],
        },
        {
          id: 'transcripcion',
          name: 'Local transcription',
          meta: 'Desktop',
          status: 'In development',
          text: 'Transcribes system and microphone audio on the device, separating speakers.',
          chips: ['Whisper', 'Diarization', 'Local'],
          image: '/concept/transcripcion.webp',
          thumb: '/concept/transcripcion-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problem', text: 'Transcribing meetings without sending audio to third parties.' },
            { icon: 'lightbulb', label: 'My part', text: 'Capture, transcription and speaker separation, all local.' },
            { icon: 'trend', label: 'Result', text: 'Nothing leaves the machine; exports to Markdown and SRT.' },
          ],
        },
        {
          id: 'busqueda',
          name: 'Agentic search',
          meta: 'Prototype',
          status: 'Open source',
          text: 'An agent that searches, reads and cross-checks sources before answering.',
          chips: ['Agents', 'RAG', 'Citations'],
          image: '/concept/busqueda.webp',
          thumb: '/concept/busqueda-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problem', text: 'AI answers without sources anyone can check.' },
            { icon: 'lightbulb', label: 'My part', text: 'A visible agent trace and a cross-check of every claim.' },
            { icon: 'trend', label: 'Result', text: 'Every claim links to the source behind it.' },
          ],
        },
        {
          id: 'panel',
          name: 'Operations panel',
          meta: 'Web',
          status: 'Anonymized case',
          text: 'Work orders, equipment and approvals for an industrial operation.',
          chips: ['Laravel', 'Dashboards'],
          image: '/concept/panel.webp',
          thumb: '/concept/panel-thumb.webp',
          facts: [
            { icon: 'alert', label: 'Problem', text: 'The state of the operation lived in scattered spreadsheets.' },
            { icon: 'lightbulb', label: 'My part', text: 'Data model, panel and approval flow.' },
            { icon: 'trend', label: 'Result', text: 'One place to see orders, equipment and pending items.' },
          ],
        },
      ],
      primary: 'Open repository',
      secondary: 'View details',
    },
    systems: {
      kind: 'systems',
      eyebrow: 'Systems',
      title: ['Evolving systems', 'under constraints'],
      summary: 'A legacy system modernized without stopping the operation that depends on it.',
      caseLabel: 'Anonymized case',
      caseName: 'Legacy system modernization',
      before: { title: 'Before', items: ['PHP monolith with ~100 tables', 'Manual deployments'] },
      after: { title: 'After', items: ['Laravel modules with tests', 'Deploy per module'] },
      mapTitle: 'Migration map',
      mapNote: 'Illustrative data',
      legend: { migrated: 'Migrated', active: 'In progress', pending: 'Pending' },
      modules: [
        'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated', 'migrated',
        'migrated', 'migrated', 'migrated', 'active', 'active', 'migrated', 'migrated', 'pending',
        'migrated', 'active', 'pending', 'pending', 'migrated', 'pending', 'pending', 'pending',
      ],
      steps: [
        { icon: 'factory', label: 'Context', text: 'A continuous industrial operation; the system records orders, equipment and approvals.' },
        { icon: 'alert', label: 'Constraint', text: 'It cannot stop: every change lives alongside the system in use.' },
        { icon: 'branch', label: 'Decision', text: 'Incremental migration to Laravel, module by module.' },
        { icon: 'trend', label: 'Result', text: 'New modules with tests; the monolith is switched off in parts.' },
      ],
      primary: 'Read the case',
    },
    security: {
      kind: 'security',
      eyebrow: 'Security',
      title: ['Applied security,', 'explicit limits'],
      summary: 'Controls I implemented, how they are verified, and what I delegate on purpose.',
      boundary: { label: 'Trust boundary', text: 'The admin panel is the only door to private data.' },
      decision: {
        label: 'Architecture decision',
        title: 'Delegate auth to Cognito',
        text: 'No custom login in production: managed MFA instead of reinventing it.',
      },
      consoleTitle: 'Control register',
      command: 'npm run check:security',
      controls: [
        { status: 'implemented', id: 'auth.mfa', text: 'Password + TOTP: the admin requires a second factor' },
        { status: 'verified', id: 'headers.csp', text: 'CSP and HSTS checked on every build' },
        { status: 'verified', id: 'check.privacy', text: 'No personal data in code or history' },
        { status: 'implemented', id: 'admin.bind', text: 'The local admin listens on 127.0.0.1 only' },
        { status: 'verified', id: 'deps.audit', text: 'Dependencies audited: 0 vulnerabilities' },
        { status: 'planned', id: 'cv.ratelimit', text: 'Rate limit on the CV request form' },
      ],
      statusLabels: { implemented: 'Implemented', verified: 'Verified', planned: 'Planned' },
      tally: '6 controls · 3 verified · 2 implemented · 1 planned',
      primary: 'View the threat model',
    },
    research: {
      kind: 'research',
      eyebrow: 'Research',
      title: ['An argument', 'open to refutation'],
      summary: 'Independent research on thought, truth and representation in AI systems.',
      questionLabel: 'Central question',
      question: 'Can a system that only predicts text tell what it says from what is the case?',
      chain: [
        { icon: 'lightbulb', label: 'Thesis', text: 'Without a model of the world to check against, output is coherence, not truth.' },
        { icon: 'scale', label: 'Strongest objection', text: 'Coherence at scale might be enough to approximate truth.' },
        { icon: 'alert', label: 'Limit', text: 'The argument does not measure capability: it bounds what counts as knowing.' },
      ],
      distinctionsTitle: 'Distinctions',
      distinctions: [
        { term: 'Output vs truth', text: 'What a model says is not what is the case.' },
        { term: 'Representation', text: 'A model of the world is not the world.' },
      ],
      notes: { label: 'Public document', title: 'Research notes', meta: '12 min read' },
      primary: 'Read the argument',
    },
    contact: {
      kind: 'contact',
      eyebrow: 'Contact',
      title: ['Direct contact,', 'no detours'],
      summary: 'For roles and collaborations: write directly or request my CV.',
      availability: 'Open to AI product engineering roles · remote or hybrid',
      channels: [
        { id: 'email', label: 'Email', text: 'I reply within 24–48 h' },
        { id: 'github', label: 'GitHub', text: 'Public code and projects' },
        { id: 'linkedin', label: 'LinkedIn', text: 'Career and professional context' },
      ],
      form: {
        title: 'Request CV',
        text: 'Shared on request. A quick check keeps it away from bots.',
        fields: { name: 'Name', company: 'Company', email: 'Work email' },
        human: 'I am human',
        submit: 'Request CV',
        note: 'I reply personally.',
        sent: 'Concept: sending is not wired up.',
      },
    },
  },
}

const COPY: Record<SiteLocale, StageCopy> = { en: EN, es: ES }

export function stageCopy(locale: SiteLocale): StageCopy {
  return COPY[locale]
}
