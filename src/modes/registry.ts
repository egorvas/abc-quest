import type { SkillId } from '../engine/skills'
import { CHANNEL_WEIGHT } from '../engine/skills'
import type { Level, ModeId } from './types'
import type { ReadSkillId } from '../engine/reading'

export interface ModeMeta {
  readonly id: ModeId
  readonly title: string
  readonly emoji: string
  readonly blurb: string
  readonly skill: SkillId
  readonly needsMic?: boolean
  /** Number of options shown on screen, target included. */
  readonly options: (level: Level) => number
  /** Chance of being right by luck. */
  readonly gamma: (level: Level, options: number) => number
  /** Evidence weight of the channel at this level. */
  readonly weight: (level: Level) => number
  /**
   * Largest slice of one round this exercise may take.
   *
   * Tracing and speaking are the slowest and the most demanding, so they stay
   * small: a round that opens with three tracing exercises in a row is how a
   * child decides the game is boring, however useful the channel is.
   */
  readonly maxShare: number
  /** Included in the mixed adventure session. */
  readonly inAdventure: boolean
}

const pick = (_level: Level, options: number) => 1 / Math.max(2, options)

export const MODES: Readonly<Record<ModeId, ModeMeta>> = {
  hearPick: {
    id: 'hearPick',
    title: 'Listen and find',
    emoji: '👂',
    blurb: 'Hear a letter, tap it',
    skill: 'spot',
    options: (level) => (level === 1 ? 3 : level === 2 ? 4 : level === 3 ? 8 : 12),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition,
    maxShare: 0.3,
    inAdventure: true,
  },
  chooseIt: {
    id: 'chooseIt',
    title: 'Which letter?',
    emoji: '🔊',
    blurb: 'See a letter, pick its name',
    skill: 'name',
    options: (level) => (level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 5 : 6),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition,
    maxShare: 0.3,
    inAdventure: true,
  },
  sayIt: {
    id: 'sayIt',
    title: 'Say the letter',
    emoji: '🎤',
    blurb: 'Say the letter out loud',
    skill: 'name',
    needsMic: true,
    options: () => 1,
    gamma: () => 0.02,
    weight: () => CHANNEL_WEIGHT.production,
    maxShare: 0.15,
    inAdventure: true,
  },
  typeIt: {
    id: 'typeIt',
    title: 'Type the letter',
    emoji: '⌨️',
    blurb: 'Find the letter on the keyboard',
    skill: 'prod',
    options: () => 26,
    gamma: () => 1 / 26,
    // Level 1 shows the letter, so it is copying, not recall.
    weight: (level) =>
      level === 1 ? CHANNEL_WEIGHT.recognition : CHANNEL_WEIGHT.recall,
    maxShare: 0.2,
    inAdventure: true,
  },
  hunt: {
    id: 'hunt',
    title: 'Letter hunt',
    emoji: '🔍',
    blurb: 'Find every copy in the field',
    skill: 'spot',
    options: (level) => (level === 1 ? 12 : level === 2 ? 20 : level === 3 ? 28 : 36),
    // Many tiles, several targets: luck is negligible but not zero.
    gamma: () => 0.08,
    // Finding the letter in unfamiliar shapes is the most valuable recognition.
    weight: () => CHANNEL_WEIGHT.recognition * 1.2,
    maxShare: 0.25,
    inAdventure: true,
  },
  pairs: {
    id: 'pairs',
    title: 'Big and small',
    emoji: '🃏',
    blurb: 'Match A with a',
    skill: 'case',
    options: (level) => (level === 1 ? 4 : level === 2 ? 5 : level === 3 ? 6 : 8),
    gamma: () => 0.2,
    weight: () => CHANNEL_WEIGHT.recall,
    maxShare: 0.25,
    inAdventure: true,
  },
  traceIt: {
    id: 'traceIt',
    title: 'Trace the letter',
    emoji: '✏️',
    blurb: 'Write the letter with a finger',
    skill: 'prod',
    options: () => 1,
    gamma: () => 0.05,
    // Levels 1-2 trace a visible outline: copying. Level 3 is from memory.
    weight: (level) =>
      level >= 3 ? CHANNEL_WEIGHT.production : CHANNEL_WEIGHT.recognition,
    maxShare: 0.15,
    inAdventure: true,
  },
  firstSound: {
    id: 'firstSound',
    title: 'A is for Apple',
    emoji: '🍎',
    blurb: 'Which letter the word starts with',
    skill: 'sound',
    options: (level) => (level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : 5),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition * 1.2,
    maxShare: 0.5,
    inAdventure: true,
  },

  /* ---- reading. `skill` is the focus letter's cell; the word cell is
          updated alongside it through Attempt.wordSkill. ---- */

  missingLetter: {
    id: 'missingLetter',
    title: 'The missing letter',
    emoji: '🕳️',
    blurb: 'One letter fell out of the word',
    skill: 'sound',
    // Levels 1-3 pick a tile; level 4 types it, so the mode changes channel.
    options: (level) => (level === 1 ? 3 : level === 4 ? 26 : 4),
    gamma: pick,
    weight: (level) =>
      level === 4
        ? CHANNEL_WEIGHT.production
        : level === 3
          ? CHANNEL_WEIGHT.recall
          : CHANNEL_WEIGHT.recognition * 1.2,
    maxShare: 0.25,
    inAdventure: true,
  },
  readPick: {
    id: 'readPick',
    title: 'What does it say?',
    emoji: '🖼️',
    blurb: 'Read the word, find its picture',
    skill: 'sound',
    options: (level) => (level === 1 ? 3 : level === 4 ? 5 : 4),
    gamma: pick,
    // An unfamiliar typeface at level 4: reading that survives it is worth more.
    weight: (level) => CHANNEL_WEIGHT.recall * (level === 4 ? 1.2 : 1),
    maxShare: 0.25,
    inAdventure: true,
  },
  blendIt: {
    id: 'blendIt',
    title: 'Slide it together',
    emoji: '🫧',
    blurb: 'Push two parts into one word',
    skill: 'sound',
    options: (level) => (level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : 5),
    gamma: pick,
    // Levels 1-2 recognise the blended result; level 3 blends sound by sound
    // with no whole-word model to lean on, which is production.
    weight: (level) => (level >= 3 ? CHANNEL_WEIGHT.production : CHANNEL_WEIGHT.recall),
    maxShare: 0.2,
    inAdventure: true,
  },
  buildWord: {
    id: 'buildWord',
    title: 'Build the word',
    emoji: '🧱',
    blurb: 'Hear a word, tap its letters in order',
    skill: 'prod',
    // The bank, or 26 when the keyboard replaces it.
    options: (level) => (level === 1 ? 3 : level === 2 ? 5 : level === 3 ? 7 : 26),
    gamma: pick,
    // Level 1 shows ghost glyphs in the slots, so it is ordering, not recall.
    weight: (level) =>
      level === 1
        ? CHANNEL_WEIGHT.recognition
        : level === 4
          ? CHANNEL_WEIGHT.production
          : CHANNEL_WEIGHT.recall,
    maxShare: 0.2,
    inAdventure: true,
  },
  twinLetters: {
    id: 'twinLetters',
    title: 'The twins',
    emoji: '👯',
    blurb: 'Two letters that look alike, one at a time',
    skill: 'spot',
    // Two options per trial; the item is the streak.
    options: () => 2,
    // Chance of passing the whole streak on coin flips.
    gamma: (level) => (level === 1 ? 0.22 : level === 4 ? 0.035 : 0.11),
    weight: (level) => CHANNEL_WEIGHT.recall * (level >= 3 ? 1.25 : 1),
    maxShare: 0.15,
    inAdventure: true,
  },
}

/** Modes that work on a word. The scheduler gates them on the sound cell. */
export const READING_MODES: readonly ModeId[] = ['missingLetter', 'readPick', 'blendIt', 'buildWord']

/** Which word skill each reading mode is evidence for. */
export const WORD_SKILL_OF: Readonly<Partial<Record<ModeId, ReadSkillId>>> = {
  missingLetter: 'blend',
  readPick: 'read',
  blendIt: 'blend',
  buildWord: 'build',
}

export const MODE_LIST: readonly ModeMeta[] = Object.values(MODES)

export function modesForSkill(skill: SkillId): readonly ModeMeta[] {
  return MODE_LIST.filter((mode) => mode.skill === skill)
}
