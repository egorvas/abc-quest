import type { SkillId } from '../engine/skills'
import { CHANNEL_WEIGHT } from '../engine/skills'
import type { Level, ModeId } from './types'

export interface ModeMeta {
  readonly id: ModeId
  readonly titleRu: string
  readonly emoji: string
  readonly blurbRu: string
  readonly skill: SkillId
  readonly needsMic?: boolean
  /** Number of options shown on screen, target included. */
  readonly options: (level: Level) => number
  /** Chance of being right by luck. */
  readonly gamma: (level: Level, options: number) => number
  /** Evidence weight of the channel at this level. */
  readonly weight: (level: Level) => number
  /** Included in the mixed adventure session. */
  readonly inAdventure: boolean
}

const pick = (_level: Level, options: number) => 1 / Math.max(2, options)

export const MODES: Readonly<Record<ModeId, ModeMeta>> = {
  hearPick: {
    id: 'hearPick',
    titleRu: 'Послушай и найди',
    emoji: '👂',
    blurbRu: 'Слышишь букву — нажимаешь на неё',
    skill: 'spot',
    options: (level) => (level === 1 ? 3 : level === 2 ? 4 : 6),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition,
    inAdventure: true,
  },
  chooseIt: {
    id: 'chooseIt',
    titleRu: 'Какая это буква?',
    emoji: '🔊',
    blurbRu: 'Видишь букву — выбираешь её имя',
    skill: 'name',
    options: (level) => (level === 1 ? 2 : level === 2 ? 3 : 4),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition,
    inAdventure: true,
  },
  sayIt: {
    id: 'sayIt',
    titleRu: 'Скажи букву',
    emoji: '🎤',
    blurbRu: 'Называешь букву вслух',
    skill: 'name',
    needsMic: true,
    options: () => 1,
    gamma: () => 0.02,
    weight: () => CHANNEL_WEIGHT.production,
    inAdventure: true,
  },
  typeIt: {
    id: 'typeIt',
    titleRu: 'Напечатай букву',
    emoji: '⌨️',
    blurbRu: 'Находишь букву на клавиатуре',
    skill: 'prod',
    options: () => 26,
    gamma: () => 1 / 26,
    // Level 1 shows the letter, so it is copying, not recall.
    weight: (level) =>
      level === 1 ? CHANNEL_WEIGHT.recognition : CHANNEL_WEIGHT.recall,
    inAdventure: true,
  },
  hunt: {
    id: 'hunt',
    titleRu: 'Охота за буквой',
    emoji: '🔍',
    blurbRu: 'Ищешь все такие буквы в поле',
    skill: 'spot',
    options: (level) => (level === 1 ? 12 : level === 2 ? 20 : 28),
    // Many tiles, several targets: luck is negligible but not zero.
    gamma: () => 0.08,
    // Finding the letter in unfamiliar shapes is the most valuable recognition.
    weight: () => CHANNEL_WEIGHT.recognition * 1.2,
    inAdventure: true,
  },
  pairs: {
    id: 'pairs',
    titleRu: 'Большая и маленькая',
    emoji: '🃏',
    blurbRu: 'Собираешь пары A и a',
    skill: 'case',
    options: (level) => (level === 1 ? 4 : level === 2 ? 5 : 6),
    gamma: () => 0.2,
    weight: () => CHANNEL_WEIGHT.recall,
    inAdventure: true,
  },
  traceIt: {
    id: 'traceIt',
    titleRu: 'Обведи букву',
    emoji: '✏️',
    blurbRu: 'Пишешь букву пальцем',
    skill: 'prod',
    options: () => 1,
    gamma: () => 0.05,
    // Levels 1-2 trace a visible outline: copying. Level 3 is from memory.
    weight: (level) =>
      level === 3 ? CHANNEL_WEIGHT.production : CHANNEL_WEIGHT.recognition,
    inAdventure: true,
  },
  firstSound: {
    id: 'firstSound',
    titleRu: 'A — Apple',
    emoji: '🍎',
    blurbRu: 'С какой буквы начинается слово',
    skill: 'sound',
    options: (level) => (level === 1 ? 2 : level === 2 ? 3 : 4),
    gamma: pick,
    weight: () => CHANNEL_WEIGHT.recognition * 1.2,
    inAdventure: true,
  },
}

export const MODE_LIST: readonly ModeMeta[] = Object.values(MODES)

export function modesForSkill(skill: SkillId): readonly ModeMeta[] {
  return MODE_LIST.filter((mode) => mode.skill === skill)
}
