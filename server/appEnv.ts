// The environment's phase (owner, 2026-10-18), from APP_ENV in .env. It is
// 'development' until the owner says the site goes to production. In
// development the publish rules (budgets, artifact links, example text,
// illustrative data) are warnings: the owner publishes work in progress to the
// local site and sees what is missing. In production they block the publish.
// The content's shape (the kernel schema) blocks in both, since the site
// cannot render a document that breaks it. A value other than the two throws,
// so a typo never passes for development.
export type AppEnv = 'development' | 'production'

export function appEnv(value: string | undefined = process.env.APP_ENV): AppEnv {
  if (value === undefined || value === '' || value === 'development') return 'development'
  if (value === 'production') return 'production'
  throw new Error(`APP_ENV debe ser development o production, no "${value}".`)
}

export function publishRulesBlock(env: AppEnv = appEnv()): boolean {
  return env === 'production'
}
