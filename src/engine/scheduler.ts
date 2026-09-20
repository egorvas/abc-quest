import type { LetterId } from '../data/letters'
import { LETTER_IDS } from '../data/letters'
import type { Profile } from '../storage/schema'
import type { Level, ModeId, SessionItem } from '../modes/types'
import { MODES, MODE_LIST } from '../modes/registry'
import type { GlyphCase, SkillId } from './skills'
import { cellKey, CORE_SKILLS, SKILLS } from './skills'
import { NEW_CELL, recall } from './memory'
import { INTRO_ORDER, sameRhymeFamily } from './curriculum'
import { contrastDecision, partnersOf } from './confusion'
import { TUNING } from './tuning'
import { letterStability, letterStatus } from './mastery'

/**
 * Builds the queue of questions for one session.
 *
 * The rules that matter, in order of importance:
 *  - the child must start and finish on something they can definitely do;
 *  - the middle is mostly weak material, because that is where learning is;
 *  - a letter never comes back two or three questions later, which would test
 *    working memory rather than learning;
 *  - a new letter is introduced at most one per session, and never while the
 *    child is already juggling too many half-learned ones.
 */

export interface BuildOptions {
  readonly length?: number
  /** Restrict to these modes (free play). Empty means the mixed adventure. */
  readonly modeIds?: readonly ModeId[]
  readonly level?: Level
  readonly micAvailable: boolean
  readonly lowercaseEnabled: boolean
}

export interface SessionPlan {
  readonly items: readonly SessionItem[]
  /** Letters newly introduced by this plan, to be stored on the profile. */
  readonly introduced: readonly LetterId[]
}

type Bucket = 'new' | 'weak' | 'review' | 'easy'

interface Candidate {
  readonly letter: LetterId
  readonly modeId: ModeId
  readonly skill: SkillId
  readonly glyphCase: GlyphCase
  readonly p: number
  readonly bucket: Bucket
}

function cellRecall(
  profile: Profile,
  letter: LetterId,
  skill: SkillId,
  glyphCase: GlyphCase,
  now: number,
): number {
  const cell = profile.cells[cellKey(letter, skill, glyphCase)] ?? NEW_CELL
  return recall(cell, now)
}

/** Targets the weaker of the two cases, which is where the gap usually is. */
function weakerCase(
  profile: Profile,
  letter: LetterId,
  skill: SkillId,
  now: number,
  lowercaseEnabled: boolean,
): GlyphCase {
  if (!SKILLS[skill].caseSensitive || !lowercaseEnabled) return 'upper'
  const upper = cellRecall(profile, letter, skill, 'upper', now)
  const lower = cellRecall(profile, letter, skill, 'lower', now)
  // Lowercase only starts appearing once uppercase has some footing.
  if (upper < 0.35) return 'upper'
  return lower <= upper ? 'lower' : 'upper'
}

function bucketOf(p: number, attempted: boolean): Bucket {
  if (!attempted) return 'new'
  if (p < TUNING.weakBelow) return 'weak'
  if (p < TUNING.easyAbove) return 'review'
  return 'easy'
}

/**
 * Letters the child is still juggling.
 *
 * Deliberately not "not yet mastered": mastery needs success on two different
 * days, so on a first enthusiastic afternoon nothing can be mastered and the
 * curriculum would stall at six letters forever. What matters for pacing is
 * how many letters are still shaky right now.
 */
function openLetters(profile: Profile, now: number): readonly LetterId[] {
  return profile.introduced.filter((letter) => {
    if (letterStatus(profile, letter, now).stage === 'mastered') return false
    return letterStability(profile, letter) < TUNING.settledHalfLifeDays
  })
}

/** Decides whether a fresh letter joins the curriculum this session. */
export function nextIntroductions(
  profile: Profile,
  now: number,
): readonly LetterId[] {
  const known = new Set(profile.introduced)
  const remaining = INTRO_ORDER.filter((letter) => !known.has(letter))
  if (remaining.length === 0) return []

  // Cold start: three letters, so a choice screen has something to choose from.
  if (profile.introduced.length === 0) return remaining.slice(0, 3)

  if (openLetters(profile, now).length > TUNING.maxOpenBeforeNew) return []
  return remaining.slice(0, TUNING.maxNewPerSession)
}

function availableModes(options: BuildOptions): readonly ModeId[] {
  const explicit = options.modeIds ?? []
  const pool = explicit.length > 0 ? explicit.map((id) => MODES[id]) : MODE_LIST.filter((m) => m.inAdventure)
  return pool.filter((mode) => options.micAvailable || !mode.needsMic).map((m) => m.id)
}

/**
 * Chooses which exercise to give a letter: the one that targets its weakest
 * core channel, among the modes currently available.
 */
/** Exercises that ask the child to produce the letter rather than find it. */
const DEMANDING: readonly ModeId[] = ['sayIt', 'typeIt', 'traceIt']
/** The gentle ways to meet a letter for the first time. */
const GENTLE: readonly ModeId[] = ['hearPick', 'chooseIt', 'firstSound']

function modeForLetter(
  profile: Profile,
  letter: LetterId,
  modeIds: readonly ModeId[],
  now: number,
  lowercaseEnabled: boolean,
  bucket: Bucket,
  used: Map<ModeId, number>,
  cap: number,
): ModeId {
  // A letter the child has never seen is introduced by recognising it, never
  // by being asked to say or write it. Meeting a glyph for the first time in a
  // production exercise is just a guaranteed failure. The same holds while the
  // letter is still weak: production has to be earned.
  const eligible =
    bucket === 'new' || bucket === 'weak'
      ? modeIds.filter((id) => !DEMANDING.includes(id))
      : modeIds
  const pool = eligible.length > 0 ? eligible : modeIds

  if (bucket === 'new') {
    const first = GENTLE.find((id) => pool.includes(id))
    if (first) return first
  }

  const scored = pool.map((id) => {
    const mode = MODES[id]
    const glyphCase = weakerCase(profile, letter, mode.skill, now, lowercaseEnabled)
    const p = cellRecall(profile, letter, mode.skill, glyphCase, now)
    // Core skills first, then whichever channel is weakest. A mode already used
    // its share of the round is pushed back, so no round turns into fourteen
    // tracing exercises in a row.
    const corePriority = CORE_SKILLS.includes(mode.skill) ? 0 : 0.25
    const overuse = Math.max(0, (used.get(id) ?? 0) - cap + 1) * 0.5
    return { id, score: p + corePriority + overuse + Math.random() * 0.12 }
  })
  scored.sort((a, b) => a.score - b.score)
  const chosen = scored[0]?.id ?? pool[0]
  used.set(chosen, (used.get(chosen) ?? 0) + 1)
  return chosen
}

function buildCandidates(
  profile: Profile,
  letters: readonly LetterId[],
  modeIds: readonly ModeId[],
  now: number,
  options: BuildOptions,
  used: Map<ModeId, number>,
  cap: number,
): readonly Candidate[] {
  return letters.map((letter) => {
    // The bucket describes the letter, not one exercise: it decides what kind
    // of question the child gets, so it cannot depend on the question.
    const coreCells = CORE_SKILLS.flatMap((skill) =>
      (['upper', 'lower'] as const).map(
        (glyphCase) => profile.cells[cellKey(letter, skill, glyphCase)] ?? NEW_CELL,
      ),
    )
    const attempted = coreCells.filter((cell) => cell.n > 0)
    const letterP =
      attempted.length === 0
        ? 0
        : attempted.reduce((sum, cell) => sum + recall(cell, now), 0) / attempted.length
    const bucket = bucketOf(letterP, attempted.length > 0)

    const modeId = modeForLetter(
      profile,
      letter,
      modeIds,
      now,
      options.lowercaseEnabled,
      bucket,
      used,
      cap,
    )
    const mode = MODES[modeId]
    const glyphCase = weakerCase(profile, letter, mode.skill, now, options.lowercaseEnabled)
    return { letter, modeId, skill: mode.skill, glyphCase, p: letterP, bucket }
  })
}

/** How many items of each kind, given how far along the child is. */
function mixCounts(length: number, masteredRatio: number, hasNew: boolean) {
  const { mix } = TUNING
  const newCount = hasNew ? Math.max(1, Math.round(length * mix.newFrac)) : 0
  const weak = Math.round(length * (mix.weakBase + mix.weakSlope * masteredRatio))
  const review = Math.round(length * (mix.reviewBase + mix.reviewSlope * masteredRatio))
  const easyMin = Math.ceil(length * mix.easyMin)
  let easy = length - newCount - weak - review
  let weakAdj = weak
  if (easy < easyMin) {
    weakAdj = Math.max(0, weak - (easyMin - easy))
    easy = easyMin
  }
  const total = newCount + weakAdj + review + easy
  return {
    new: newCount,
    weak: weakAdj + Math.max(0, length - total),
    review,
    easy,
  }
}

function takeFrom(
  pool: Candidate[],
  bucket: Bucket,
  count: number,
): Candidate[] {
  const matching = pool.filter((c) => c.bucket === bucket)
  // Weakest first inside a bucket.
  matching.sort((a, b) => a.p - b.p)
  const taken = matching.slice(0, count)
  for (const item of taken) {
    const index = pool.indexOf(item)
    if (index >= 0) pool.splice(index, 1)
  }
  return taken
}

/** Distractors for one screen, filtered by the contrast rules. */
export function pickDistractors(
  profile: Profile,
  target: LetterId,
  count: number,
  level: Level,
  now: number,
  /** Letters in play this session. Widened when there are too few to choose. */
  pool: readonly LetterId[],
): readonly LetterId[] {
  if (count <= 0) return []
  const introduced = pool.length > count ? pool : LETTER_IDS
  const targetRecall = Math.max(
    ...CORE_SKILLS.map((skill) => cellRecall(profile, target, skill, 'upper', now)),
  )
  const targetCell = profile.cells[cellKey(target, 'spot', 'upper')] ?? NEW_CELL
  const partners = new Set(partnersOf(profile.confusion, target))

  const allowed: LetterId[] = []
  const banned = new Set<LetterId>()
  let contrastPick: LetterId | null = null

  for (const candidate of introduced) {
    if (candidate === target) continue
    if (partners.has(candidate)) {
      const partnerRecall = Math.max(
        ...CORE_SKILLS.map((skill) => cellRecall(profile, candidate, skill, 'upper', now)),
      )
      const decision = contrastDecision(
        targetRecall,
        partnerRecall,
        targetCell.n,
        targetCell.cc,
      )
      if (decision.ban) {
        banned.add(candidate)
        continue
      }
      if (decision.allow && contrastPick === null) {
        contrastPick = candidate
        continue
      }
      continue
    }
    allowed.push(candidate)
  }

  // Level 1 deliberately avoids rhyme-family neighbours; level 3 seeks one out.
  const sameFamily = allowed.filter((l) => sameRhymeFamily(l, target))
  const otherFamily = allowed.filter((l) => !sameRhymeFamily(l, target))
  const ordered =
    level === 1
      ? [...shuffle(otherFamily), ...shuffle(sameFamily)]
      : level === 3
        ? [...shuffle(sameFamily).slice(0, 1), ...shuffle(otherFamily), ...shuffle(sameFamily).slice(1)]
        : shuffle([...otherFamily, ...sameFamily])

  const result: LetterId[] = []
  if (contrastPick && level >= 2) result.push(contrastPick)
  for (const candidate of ordered) {
    if (result.length >= count) break
    if (banned.has(candidate) || result.includes(candidate)) continue
    result.push(candidate)
  }
  // Very early sessions may not have enough introduced letters.
  for (const candidate of shuffle([...LETTER_IDS])) {
    if (result.length >= count) break
    if (candidate === target || banned.has(candidate) || result.includes(candidate)) continue
    result.push(candidate)
  }
  return result.slice(0, count)
}

export function shuffle<T>(input: readonly T[]): T[] {
  const array = [...input]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

/** Spreads repeats apart and puts safe items at the start and the end. */
function arrange(picked: readonly Candidate[]): readonly Candidate[] {
  const easy = picked.filter((c) => c.bucket === 'easy')
  const rest = shuffle(picked.filter((c) => c.bucket !== 'easy'))
  const opening = easy.slice(0, Math.min(2, easy.length))
  const closing = easy.slice(opening.length, opening.length + 1)
  const middle = shuffle([...rest, ...easy.slice(opening.length + closing.length)])

  const ordered = [...opening, ...middle, ...closing]

  // Push apart any letter that would repeat within the gap window.
  for (let i = 1; i < ordered.length; i += 1) {
    const window = ordered.slice(Math.max(0, i - TUNING.repeatGap), i)
    if (!window.some((c) => c.letter === ordered[i].letter)) continue
    const swapIndex = ordered.findIndex(
      (c, j) =>
        j > i &&
        !ordered
          .slice(Math.max(0, i - TUNING.repeatGap), i)
          .some((w) => w.letter === c.letter),
    )
    if (swapIndex > i) {
      const copy = ordered[i]
      ordered[i] = ordered[swapIndex]
      ordered[swapIndex] = copy
    }
  }
  return ordered
}

export function buildSession(
  profile: Profile,
  now: number,
  options: BuildOptions,
): SessionPlan {
  const modeIds = availableModes(options)
  const fresh = nextIntroductions(profile, now)
  const letters = [...profile.introduced, ...fresh]
  const level: Level = options.level ?? 1
  // Early on there are only a handful of letters. A full-length round would
  // just ask about the same three over and over.
  const length = Math.max(
    4,
    Math.min(options.length ?? TUNING.sessionLength, letters.length * 3),
  )

  if (letters.length === 0 || modeIds.length === 0) {
    return { items: [], introduced: [] }
  }

  // No single exercise may take more than a quarter of the round.
  const modeCap = Math.max(2, Math.ceil(length / 4))
  const modeUsage = new Map<ModeId, number>()
  const candidates = buildCandidates(profile, letters, modeIds, now, options, modeUsage, modeCap)
  const masteredRatio =
    profile.introduced.filter(
      (letter) => letterStatus(profile, letter, now).stage === 'mastered',
    ).length / LETTER_IDS.length
  const counts = mixCounts(length, masteredRatio, fresh.length > 0)

  const pool = [...candidates]
  const picked: Candidate[] = [
    ...takeFrom(pool, 'new', counts.new),
    ...takeFrom(pool, 'weak', counts.weak),
    ...takeFrom(pool, 'review', counts.review),
    ...takeFrom(pool, 'easy', counts.easy),
  ]

  // Short curricula run out of distinct letters: repeat the weakest ones.
  let guard = 0
  while (picked.length < length && guard < length * 4) {
    guard += 1
    const sorted = [...candidates].sort((a, b) => a.p - b.p)
    const next = sorted[picked.length % sorted.length]
    if (next) picked.push(next)
    else break
  }

  const arranged = arrange(picked.slice(0, length))

  const items = arranged.map((candidate, index): SessionItem => {
    const mode = MODES[candidate.modeId]
    const itemLevel = pickLevel(candidate, level)
    const optionCount = mode.options(itemLevel)
    const distractorCount =
      candidate.modeId === 'typeIt' || candidate.modeId === 'sayIt' || candidate.modeId === 'traceIt'
        ? 0
        : Math.max(0, optionCount - 1)
    return {
      id: `${candidate.letter}-${candidate.modeId}-${index}`,
      letter: candidate.letter,
      modeId: candidate.modeId,
      skill: candidate.skill,
      glyphCase: candidate.glyphCase,
      level: itemLevel,
      distractors: pickDistractors(
        profile,
        candidate.letter,
        distractorCount,
        itemLevel,
        now,
        letters,
      ),
      reason: candidate.bucket,
    }
  })

  return { items, introduced: fresh }
}

/** A brand-new letter always starts at the easiest level, whatever is asked. */
function pickLevel(candidate: Candidate, requested: Level): Level {
  if (candidate.bucket === 'new') return 1
  if (candidate.bucket === 'weak' && requested === 3) return 2
  return requested
}
