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

describe('content kernel boundary', () => {
  it('rejects React, three and the DOM sanitizer', async () => {
    const code = "import React from 'react'\nimport * as THREE from 'three'\nimport DOMPurify from 'dompurify'\nexport { React, THREE, DOMPurify }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toHaveLength(3)
  })

  it('rejects imports from the site', async () => {
    const code = "import { SidePanels } from '../features/premium-cube/SidePanels'\nexport { SidePanels }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toHaveLength(1)
  })

  it('allows zod, its own files and the example content', async () => {
    const code =
      "import { z } from 'zod'\nimport { CUBE_FACE_ORDER } from './faces'\nimport example from '../../public/content/site.example.en.json'\nexport { z, CUBE_FACE_ORDER, example }\n"
    expect(await restrictedImports('src/kernel/probe.ts', code)).toEqual([])
  })
})

describe('admin server boundary', () => {
  it('rejects site modules outside the kernel', async () => {
    const code = "import { SidePanels } from '../../src/features/premium-cube/SidePanels'\nexport { SidePanels }\n"
    expect(await restrictedImports('server/content/probe.ts', code)).toHaveLength(1)
  })

  it('allows the kernel', async () => {
    const code = "import { SiteContentSchema } from '../../src/kernel/siteContent'\nexport { SiteContentSchema }\n"
    expect(await restrictedImports('server/content/probe.ts', code)).toEqual([])
  })
})
