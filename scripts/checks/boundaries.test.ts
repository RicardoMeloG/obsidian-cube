// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// The architecture boundaries in eslint.config.js (ADR 005, spec 010 H-04b and
// H-15), proved against probe files: a weakened rule fails here.
const eslint = new ESLint()

async function restrictedImports(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((message) => message.ruleId === 'no-restricted-imports').map((message) => message.message)
}

async function restrictedSyntax(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax').map((message) => message.message)
}

describe('content kernel boundary', () => {
  it('rejects React, three and the DOM sanitizer', async () => {
    const code = "import React from 'react'\nimport * as THREE from 'three'\nimport DOMPurify from 'dompurify'\nexport { React, THREE, DOMPurify }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toHaveLength(3)
  })

  it('rejects imports from the site', async () => {
    const code = "import { FaceRails } from '../features/faces/FaceRails'\nexport { FaceRails }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toHaveLength(1)
  })

  it('rejects relative paths to lib, the tooling and lazy imports (audit-2 B-06)', async () => {
    expect(await restrictedImports('src/kernel/probe.ts', "import { hasWebGL } from '../lib/hasWebGL'\nexport { hasWebGL }\n")).not.toEqual([])
    expect(await restrictedImports('src/kernel/probe.ts', "import budget from '../../scripts/checks/budget.json'\nexport { budget }\n")).not.toEqual([])
    const [result] = await eslint.lintText("export const load = () => import('three')\n", { filePath: 'src/kernel/probe.ts' })
    expect(result.messages.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true)
  })

  it('allows zod, its own files and the example content', async () => {
    const code =
      "import { z } from 'zod'\nimport { FACE_ORDER } from './faces'\nimport example from '../../public/content/site.example.en.json'\nexport { z, FACE_ORDER, example }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toEqual([])
  })
})

describe('admin server boundary', () => {
  it('rejects site modules outside the kernel', async () => {
    const code = "import { FaceRails } from '../../src/features/faces/FaceRails'\nexport { FaceRails }\n"
    expect(await restrictedImports('server/content/probe.ts', code)).toHaveLength(1)
  })

  it('allows the kernel', async () => {
    const code = "import { SiteContentSchema } from '../../src/kernel/siteContent'\nexport { SiteContentSchema }\n"
    expect(await restrictedImports('server/content/probe.ts', code)).toEqual([])
  })
})

describe('stage boundary (spec 011, AD-07)', () => {
  it('keeps the scene, audio and app out of the stage', async () => {
    const code = "import { CubeScene } from '@/features/scene/CubeScene'\nimport { Experience } from '@/app/Experience'\nimport * as THREE from 'three'\nexport { CubeScene, Experience, THREE }\n"
    expect(await restrictedImports('src/features/stage/probe.tsx', code)).toHaveLength(3)
  })

  it('allows the experience store, content, ui and the kernel', async () => {
    const code =
      "import { useExperience } from '@/features/experience/experienceStore'\nimport { RichText } from '@/features/content/RichText'\nimport { cx } from '@/ui/cx'\nimport { ICON_IDS } from '@/kernel/icons'\nexport { useExperience, RichText, cx, ICON_IDS }\n"
    expect(await restrictedImports('src/features/stage/probe.tsx', code)).toEqual([])
  })

  it('rejects words written in the markup and locale comparisons', async () => {
    const code = 'export const A = ({ locale }: { locale: string }) => <p aria-label="Caras del cubo">{locale === \'es\' ? 1 : 2} Hola mundo</p>\n'
    expect(await restrictedSyntax('src/features/stage/probe.tsx', code)).toHaveLength(3)
  })

  it('allows single tokens such as the GitHub label and class names', async () => {
    const code = 'export const A = () => <span className="st-button focus-ring">GitHub</span>\n'
    expect(await restrictedSyntax('src/features/stage/probe.tsx', code)).toEqual([])
  })
})

describe('site module boundaries (ADR 006)', () => {
  const imports = (from: string, specifier: string) => restrictedImports(from, `import { x } from '${specifier}'\nexport { x }\n`)

  it('keep the scene and the DOM features apart; they meet in the experience store', async () => {
    expect(await imports('src/features/faces/probe.tsx', '@/features/scene/CubeScene')).toHaveLength(1)
    expect(await imports('src/features/navigation/probe.tsx', '@/features/scene/SceneLayer')).toHaveLength(1)
    expect(await imports('src/features/scene/probe.tsx', '@/features/faces/FaceRails')).toHaveLength(1)
    expect(await imports('src/features/faces/probe.tsx', 'three')).toHaveLength(1)
    expect(await imports('src/features/scene/probe.tsx', '@/features/experience/experienceStore')).toEqual([])
    expect(await imports('src/features/faces/probe.tsx', '@/features/experience/experienceStore')).toEqual([])
  })

  it('keep ui primitives, lib and the experience store free of features', async () => {
    expect(await imports('src/ui/probe.tsx', '@/features/content/copy')).toHaveLength(1)
    expect(await imports('src/lib/probe.ts', '@/kernel/faces')).toHaveLength(1)
    expect(await imports('src/features/experience/probe.ts', '@/ui/cx')).toHaveLength(1)
    expect(await imports('src/features/experience/probe.ts', '@/features/scene/CubeScene')).toHaveLength(1)
    expect(await imports('src/features/experience/probe.ts', '@/kernel/faces')).toEqual([])
  })

  it('reject relative paths that climb into another module', async () => {
    expect(await imports('src/features/faces/probe.tsx', '../scene/CubeScene')).not.toEqual([])
    expect(await imports('src/features/faces/probe.tsx', '../../ui/cx')).not.toEqual([])
  })

  it('keep locale comparisons and lazy loading out of the interface', async () => {
    const compare = "export const label = (locale: string) => (locale === 'es' ? 'Cerrar' : 'Close')\n"
    const lazy = "export const load = () => import('./x')\n"
    expect(await restrictedSyntax('src/features/faces/probe.tsx', compare)).toHaveLength(1)
    expect(await restrictedSyntax('src/features/faces/probe.tsx', lazy)).toHaveLength(1)
    expect(await restrictedSyntax('src/features/scene/probe.tsx', lazy)).toEqual([])
  })
})

