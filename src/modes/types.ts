import type { LetterId } from '../data/letters'
import type { GlyphCase, SkillId } from '../engine/skills'

export type Level = 1 | 2 | 3

export const MODE_IDS = [
  'hearPick',
  'chooseIt',
  'sayIt',
  'typeIt',
  'hunt',
  'pairs',
  'traceIt',
  'firstSound',
] as const

export type ModeId = (typeof MODE_IDS)[number]

/** One question put to the child. */
export interface SessionItem {
  readonly id: string
  readonly letter: LetterId
  readonly modeId: ModeId
  readonly skill: SkillId
  readonly glyphCase: GlyphCase
  readonly level: Level
  /** Wrong options for this screen, already filtered by the confusion rules. */
  readonly distractors: readonly LetterId[]
  /** Why the scheduler picked this item, for the parent screen. */
  readonly reason: 'new' | 'weak' | 'review' | 'easy'
}

export type Verdict = 'right' | 'almost' | 'miss'

/** What the child actually did, fed back into the memory engine. */
export interface Attempt {
  readonly item: SessionItem
  readonly verdict: Verdict
  /** The game had to reveal the answer first. */
  readonly assisted: boolean
  /** Wrong letters picked before the right one, for the confusion map. */
  readonly wrongPicks: readonly LetterId[]
  readonly responseMs: number
  /** Chance of being right by luck in the exercise as it was actually shown. */
  readonly gamma: number
  /** Evidence weight of the channel the answer came through. */
  readonly weight: number
}

export interface ModeProps {
  readonly item: SessionItem
  readonly onDone: (attempt: Attempt) => void
  /** Changes whenever a new item starts, so modes reset their local state. */
  readonly seq: number
}
