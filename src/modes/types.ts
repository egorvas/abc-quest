import type { LetterId } from '../data/letters'
import type { WordId } from '../data/words'
import type { GlyphCase, SkillId } from '../engine/skills'
import type { ReadSkillId } from '../engine/reading'

/**
 * 1-3 walk a letter from first meeting to solid. 4 is the expert tier for a
 * child who already reads the alphabet: many more options on screen, upper and
 * lower case mixed together, the letter they confuse it with always present,
 * and most of the round spent producing letters rather than recognising them.
 */
export type Level = 1 | 2 | 3 | 4

export const MODE_IDS = [
  'hearPick',
  'chooseIt',
  'sayIt',
  'typeIt',
  'hunt',
  'pairs',
  'traceIt',
  'firstSound',
  'missingLetter',
  'readPick',
  'blendIt',
  'buildWord',
  'twinLetters',
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
  /**
   * Draw the wrong options in whichever case they land on rather than all in
   * the target's case. Finding "b" among A, b, D, e is a different, harder
   * skill than finding it among four capitals.
   */
  readonly mixedCaseOptions: boolean
  /** Why the scheduler picked this item, for the parent screen. */
  readonly reason: 'new' | 'weak' | 'review' | 'easy'

  /* ---- reading items. `letter` stays the focus grapheme under test. ---- */

  /** The word this question is about. */
  readonly wordId?: WordId
  /** Index into the word's grapheme units: the blank, or the unit changed. */
  readonly gapIndex?: number
  /** Wrong-answer words for picture choices, minimal pairs already chosen. */
  readonly wordDistractors?: readonly WordId[]
  /** How the word is cut on screen. */
  readonly segmentation?: 'onsetRime' | 'phoneme' | 'syllable'
  /** The confusable partner a twin drill is built around. */
  readonly twin?: LetterId
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
  /**
   * For a reading item: which word skill the answer is evidence for. The
   * focus letter's own cell is updated as usual; the word cell is updated
   * alongside it.
   */
  readonly wordSkill?: ReadSkillId
  /** Graphemes the child placed with their own hands (build mode). */
  readonly placed?: readonly string[]
  /** The grapheme the child got wrong, when the mode can tell. */
  readonly wrongGrapheme?: string
}

export interface ModeProps {
  readonly item: SessionItem
  readonly onDone: (attempt: Attempt) => void
  /** Changes whenever a new item starts, so modes reset their local state. */
  readonly seq: number
}
