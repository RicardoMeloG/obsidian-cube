// The profile for machines (spec 012, AD-07): a document of its own per
// language (profile.{en,es}.json, edited in the admin), with the facts that
// have no layout to fit. The build writes it into /llms.txt and the plain
// profile pages (seo/renderMachine.ts); the site never loads it, so the first
// view does not carry it. Pure, like the rest of the kernel.
import { z } from 'zod/mini'
import exampleEn from '../../public/content/profile.example.en.json'
import exampleEs from '../../public/content/profile.example.es.json'
import { RichTextSchema } from './fields'
import type { Issue } from './publishRules'
import type { SiteLocale } from './siteContent'

const Text = z.string().check(z.minLength(1))

export const ProfileContentSchema = z
  .object({
    locale: z.enum(['en', 'es']).clone().register(z.globalRegistry, { title: 'Idioma', widget: 'fixed' }),
    about: RichTextSchema.clone().register(z.globalRegistry, { title: 'Resumen largo' }),
    titles: z.array(Text).clone().register(z.globalRegistry, { title: 'Títulos reconocidos' }),
    skills: z.array(Text).clone().register(z.globalRegistry, { title: 'Habilidades' }),
    roles: z
      .array(
        z.object({
          title: Text.clone().register(z.globalRegistry, { title: 'Rol' }),
          years: z.optional(Text).clone().register(z.globalRegistry, { title: 'Años' }),
          text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Qué implicó' }),
        }),
      )
      .clone().register(z.globalRegistry, { title: 'Roles' }),
    research: z.optional(RichTextSchema).clone().register(z.globalRegistry, { title: 'Investigación (un párrafo)' }),
    location: z.optional(Text).clone().register(z.globalRegistry, { title: 'Ubicación' }),
    languages: z.optional(z.array(Text)).clone().register(z.globalRegistry, { title: 'Idiomas' }),
    education: z.optional(z
      .array(z.object({ name: Text.clone().register(z.globalRegistry, { title: 'Título o programa' }), institution: z.optional(Text).clone().register(z.globalRegistry, { title: 'Institución' }) })))
      .clone().register(z.globalRegistry, { title: 'Formación' }),
    // Other profiles of the owner (ORCID, a scholar page): the JSON-LD's sameAs.
    profiles: z.optional(z.array(Text)).clone().register(z.globalRegistry, { title: 'Otros perfiles (enlaces)' }),
  })
  .clone().register(z.globalRegistry, { title: 'Perfil para máquinas' })

export type ProfileContent = z.infer<typeof ProfileContentSchema>

export const EXAMPLE_PROFILES: Record<SiteLocale, ProfileContent> = {
  en: ProfileContentSchema.parse(exampleEn),
  es: ProfileContentSchema.parse(exampleEs),
}

// The example's sentences and places: written for the repository, false under
// the owner's name. Titles and skills may match it honestly.
function exampleProse(profile: ProfileContent): string[] {
  return [
    profile.about,
    profile.research,
    profile.location,
    ...profile.roles.map((role) => role.text),
    ...(profile.education ?? []).flatMap((item) => [item.name, item.institution]),
  ].filter((value): value is string => Boolean(value))
}

// The publish rules of the profile, warnings or blocking like the site's by APP_ENV.
export function profileRuleIssues(profile: ProfileContent): Issue[] {
  const issues: Issue[] = []
  profile.profiles?.forEach((href, index) => {
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(href)) issues.push({ path: ['profiles', index], message: 'Usa un enlace https:.' })
  })
  const example = new Set(Object.values(EXAMPLE_PROFILES).flatMap(exampleProse))
  if (exampleProse(profile).some((value) => example.has(value))) {
    issues.push({ path: [], message: 'Reemplaza el texto de ejemplo del perfil.' })
  }
  return issues
}
