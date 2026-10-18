// Icon catalog of the content kernel: the line icons a composition or the dock
// may name. Data only; the stage maps each id to an SVG component, and the
// admin offers the ids as a list (spec 011, AD-02).
export const ICON_IDS = [
  'sparkles',
  'box',
  'database',
  'shield',
  'book',
  'mail',
  'file',
  'send',
  'check',
  'package',
  'branch',
  'factory',
  'alert',
  'trend',
  'key',
  'scale',
  'gauge',
  'lightbulb',
  'split',
] as const

export type IconId = (typeof ICON_IDS)[number]
