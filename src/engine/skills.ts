import type { LetterId } from '../data/letters'

/**
 * Knowing a letter is not one skill.
 *
 * A child points at "B" among three tiles long before they can say its name,
 * and saying the name is easier than producing the glyph from the sound alone.
 * Each channel is tracked in its own memory cell, so the scheduler can drill
 * the weak channel instead of hammering the whole letter.
 */

export const SKILL_IDS = ['spot', 'name', 'prod', 'case', 'sound'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export type GlyphCase = 'upper' | 'lower'

export interface SkillMeta {
  readonly id: SkillId
  readonly label: string
  /** Upper and lower case are separate cells for these skills. */
  readonly caseSensitive: boolean
  /** Counts towards mastery of the letter. */
  readonly core: boolean
}

export const SKILLS: Readonly<Record<SkillId, SkillMeta>> = {
  // Hears the name, finds the glyph.
  spot: { id: 'spot', label: 'Spots it', caseSensitive: true, core: true },
  // Sees the glyph, produces or picks the name.
  name: { id: 'name', label: 'Names it', caseSensitive: true, core: true },
  // Hears the name, writes or types the glyph with nothing to copy.
  prod: { id: 'prod', label: 'Writes and types', caseSensitive: true, core: true },
  // Knows that A and a are the same letter.
  case: { id: 'case', label: 'Upper and lower case', caseSensitive: false, core: false },
  // Knows the sound the letter makes, not just its name.
  sound: { id: 'sound', label: 'Knows the sound', caseSensitive: false, core: false },
}

export const CORE_SKILLS: readonly SkillId[] = SKILL_IDS.filter((id) => SKILLS[id].core)

/**
 * How strong the evidence from one answer is.
 *
 * Recognition is cheap and lies: a child can exclude distractors with no idea
 * what the letter is. Production cannot be faked.
 */
export const CHANNEL_WEIGHT = {
  recognition: 1.0,
  recall: 1.6,
  production: 2.2,
} as const

export type Channel = keyof typeof CHANNEL_WEIGHT

/** Identity of one memory cell. */
export type CellKey = string

export function cellKey(
  letter: LetterId,
  skill: SkillId,
  glyphCase: GlyphCase,
): CellKey {
  return SKILLS[skill].caseSensitive
    ? `${letter}|${skill}|${glyphCase === 'lower' ? 'l' : 'u'}`
    : `${letter}|${skill}`
}

/** Every cell a letter owns: 3 case-sensitive skills x 2 + 2 flat = 8. */
export function cellsOf(letter: LetterId): readonly CellKey[] {
  const keys: CellKey[] = []
  for (const skill of SKILL_IDS) {
    if (SKILLS[skill].caseSensitive) {
      keys.push(cellKey(letter, skill, 'upper'), cellKey(letter, skill, 'lower'))
    } else {
      keys.push(cellKey(letter, skill, 'upper'))
    }
  }
  return keys
}

export function coreCellsOf(letter: LetterId): readonly CellKey[] {
  const keys: CellKey[] = []
  for (const skill of CORE_SKILLS) {
    keys.push(cellKey(letter, skill, 'upper'), cellKey(letter, skill, 'lower'))
  }
  return keys
}
