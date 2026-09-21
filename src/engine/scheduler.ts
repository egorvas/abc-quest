import type { LetterId } from '../data/letters'
import { LETTER_IDS } from '../data/letters'
import type { CaseMode, Difficulty, LetterPool, Profile } from '../storage/schema'
import type { WordStage } from '../data/words'
import type { Level, ModeId, SessionItem } from '../modes/types'
import { MODES, MODE_LIST, READING_MODES } from '../modes/registry'
import type { GlyphCase, SkillId } from './skills'
import { cellKey, CORE_SKILLS, SKILLS } from './skills'
import { NEW_CELL, recall } from './memory'
import { INTRO_ORDER, sameRhymeFamily } from './curriculum'
import { contrastDecision, partnersOf } from './confusion'
import { TUNING } from './tuning'
import { letterStability, letterStatus } from './mastery'
import {
  gapIndexFor,
  readingStage,
  wordBestRecall,
  wordDistractorsFor,
  wordUnlocked,
  wordsForLetter,
  type GapPosition,
} from './reading'
import { SHORT_VOWELS } from '../data/phonics'
import { WORDS } from '../data/words'

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
  readonly micAvailable: boolean
  readonly caseMode: CaseMode
  readonly letterPool: LetterPool
  readonly difficulty: Difficulty
  /**
   * A letter the child asked to practise, from its lot in the town. It takes
   * roughly forty percent of the round; the rest is the usual mix, because a
   * round that is all one letter is drilling, and drilling is boring.
   */
  readonly focus?: LetterId
  /** A lesson on the path: only these letters, no introductions. */
  readonly letters?: readonly LetterId[]
  /** A lesson's own slice of the word list, bypassing the derived stage. */
  readonly wordStages?: readonly WordStage[]
  /** A lesson's fixed level, when the setting is automatic. */
  readonly level?: Level
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
  /** Mean half-life in days, used to pick a level in automatic difficulty. */
  readonly stability: number
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

/**
 * Which shape of the letter to show.
 *
 * In mixed mode the weaker of the two is targeted, because that is where the
 * gap is. A lowercase cell that has never been touched counts as the biggest
 * gap of all, so lowercase gets real coverage instead of being crowded out by
 * the capital the child already knows. Only the very first exposure to a
 * letter is forced to the capital.
 */
function chooseCase(
  profile: Profile,
  letter: LetterId,
  skill: SkillId,
  now: number,
  caseMode: CaseMode,
): GlyphCase {
  if (!SKILLS[skill].caseSensitive) return 'upper'
  if (caseMode === 'upper') return 'upper'
  if (caseMode === 'lower') return 'lower'

  const upperCell = profile.cells[cellKey(letter, skill, 'upper')] ?? NEW_CELL
  const lowerCell = profile.cells[cellKey(letter, skill, 'lower')] ?? NEW_CELL

  if (upperCell.n === 0 && lowerCell.n === 0) return 'upper'
  if (upperCell.n === 0) return 'upper'
  if (lowerCell.n === 0) {
    const upperRecall = recall(upperCell, now)
    return upperRecall >= 0.5 || upperCell.n >= 2 ? 'lower' : 'upper'
  }
  return recall(lowerCell, now) <= recall(upperCell, now) ? 'lower' : 'upper'
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

/**
 * Decides which fresh letters join the curriculum this session.
 *
 * With a fixed pool the parent has said how many letters should be in play, so
 * the set is filled straight away and the scheduler picks the weak ones out of
 * it. That is the right shape for a child who already knows most of the
 * alphabet and needs only a handful of stragglers.
 */
export function nextIntroductions(
  profile: Profile,
  now: number,
  pool: LetterPool,
): readonly LetterId[] {
  const known = new Set(profile.introduced)
  const remaining = INTRO_ORDER.filter((letter) => !known.has(letter))
  if (remaining.length === 0) return []

  if (pool !== 'auto') {
    const target = Math.min(LETTER_IDS.length, Math.max(3, pool))
    const missing = target - profile.introduced.length
    return missing > 0 ? remaining.slice(0, missing) : []
  }

  // Cold start: three letters, so a choice screen has something to choose from.
  if (profile.introduced.length === 0) return remaining.slice(0, 3)

  if (openLetters(profile, now).length > TUNING.maxOpenBeforeNew) return []
  return remaining.slice(0, TUNING.maxNewPerSession)
}

export function availableModes(profile: Profile, options: BuildOptions): readonly ModeId[] {
  const explicit = options.modeIds ?? []
  const pool = explicit.length > 0 ? explicit.map((id) => MODES[id]) : MODE_LIST.filter((m) => m.inAdventure)
  // Reading opens once the first sound set is in. Before that a word is a
  // guaranteed failure dressed up as a lesson.
  const stage = readingStage(profile)
  const readingOpen = stage !== 'sounds' || (options.wordStages?.length ?? 0) > 0
  return pool
    .filter((mode) => options.micAvailable || !mode.needsMic)
    .filter((mode) => readingOpen || !READING_MODES.includes(mode.id))
    .map((m) => m.id)
}

/**
 * Whether a letter can carry a reading exercise right now: its sound has to
 * be known, and a word that practises it has to exist at the current stage.
 */
function readableWith(
  profile: Profile,
  letter: LetterId,
  modeId: ModeId,
  now: number,
  stages?: readonly WordStage[],
): boolean {
  if (cellRecall(profile, letter, 'sound', 'upper', now) < TUNING.reading.soundRecallToRead) {
    return false
  }
  const picturesOnly = modeId !== 'buildWord'
  return wordsForLetter(profile, now, { letter, picturesOnly, stages }).length > 0
}

/** The twin drill needs a known partner and both letters on their own feet. */
function twinFor(profile: Profile, letter: LetterId, now: number): LetterId | null {
  const partner = partnersOf(profile.confusion, letter)[0]
  if (!partner) return null
  const targetRecall = cellRecall(profile, letter, 'spot', 'upper', now)
  const partnerRecall = cellRecall(profile, partner, 'spot', 'upper', now)
  const cell = profile.cells[cellKey(letter, 'spot', 'upper')] ?? NEW_CELL
  return contrastDecision(targetRecall, partnerRecall, cell.n, cell.cc).allow ? partner : null
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
  caseMode: CaseMode,
  bucket: Bucket,
  used: Map<ModeId, number>,
  length: number,
  expert: boolean,
  stages?: readonly WordStage[],
): ModeId | null {
  // A letter the child has never seen is introduced by recognising it, never
  // by being asked to say or write it. Meeting a glyph for the first time in a
  // production exercise is just a guaranteed failure. The same holds while the
  // letter is still weak: production has to be earned.
  const eligible = modeIds.filter((id) => {
    if ((bucket === 'new' || bucket === 'weak') && DEMANDING.includes(id)) return false
    if (READING_MODES.includes(id)) return bucket !== 'new' && readableWith(profile, letter, id, now, stages)
    if (id === 'twinLetters') return twinFor(profile, letter, now) !== null
    return true
  })
  const pool =
    eligible.length > 0
      ? eligible
      : modeIds.filter((id) => !READING_MODES.includes(id) && id !== 'twinLetters')
  // A round restricted to reading, and a letter that cannot read yet: this
  // letter sits the round out rather than getting a question it cannot answer.
  if (pool.length === 0) return null

  if (bucket === 'new') {
    const first = GENTLE.find((id) => pool.includes(id))
    if (first) return first
  }

  // A child who already recognises a letter has an untouched writing channel,
  // so weakest-first would hand out nothing but tracing and typing. Production
  // as a whole is capped, on top of each mode's own share.
  const demandingUsed = DEMANDING.reduce((sum, id) => sum + (used.get(id) ?? 0), 0)
  const demandingCap = Math.max(
    2,
    Math.round(
      length * (expert ? TUNING.expertDemandingShareCap : TUNING.demandingShareCap),
    ),
  )
  // Reading gets its own slice of the round, growing with the stage, so a
  // round never turns entirely into words and the sound cells never go stale.
  const readingUsed = READING_MODES.reduce((sum, id) => sum + (used.get(id) ?? 0), 0)
  const readingShare = TUNING.reading.share[readingStage(profile)] ?? 0
  const readingCap = Math.round(length * readingShare)

  const scored = pool.map((id) => {
    const mode = MODES[id]
    const glyphCase = chooseCase(profile, letter, mode.skill, now, caseMode)
    const p = cellRecall(profile, letter, mode.skill, glyphCase, now)
    // Core skills first, then whichever channel is weakest. A mode that has
    // used up its share of the round is pushed to the back of the queue.
    const corePriority = CORE_SKILLS.includes(mode.skill) ? 0 : 0.25
    // Expert rounds lean on production, so the slow exercises get room.
    const shareCap = expert && DEMANDING.includes(id) ? mode.maxShare * 1.6 : mode.maxShare
    const cap = Math.max(1, Math.round(length * shareCap))
    // Recall sits in 0..1, so a penalty above 1 is what makes a quota bind at
    // all: below that the untouched writing channel always wins on weakness.
    const overuse = Math.max(0, (used.get(id) ?? 0) - cap + 1) * 1.2
    const demandingPenalty =
      DEMANDING.includes(id) && demandingUsed >= demandingCap ? 1.4 : 0
    const reading = READING_MODES.includes(id)
    const readingPenalty = reading && readingUsed >= readingCap ? 1.4 : 0
    // A word is judged by the word's own recall, not the letter's sound cell:
    // a sound the child knows cold can still be a word never read.
    const readingScore = reading
      ? Math.min(...wordsForLetter(profile, now, { letter, picturesOnly: id !== 'buildWord', stages })
          .slice(0, 3)
          .map((word) => wordBestRecall(profile, word, now)))
      : p
    return {
      id,
      score: (reading ? readingScore : p) + corePriority + overuse + demandingPenalty + readingPenalty + Math.random() * 0.12,
    }
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
  length: number,
): readonly Candidate[] {
  const candidates: Candidate[] = []
  for (const letter of letters) {
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
      options.caseMode,
      bucket,
      used,
      length,
      options.difficulty === 4,
      options.wordStages,
    )
    if (!modeId) continue
    const mode = MODES[modeId]
    const glyphCase = chooseCase(profile, letter, mode.skill, now, options.caseMode)
    candidates.push({
      letter,
      modeId,
      skill: mode.skill,
      glyphCase,
      p: letterP,
      bucket,
      stability: letterStability(profile, letter),
    })
  }
  return candidates
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
        level === 4,
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

  // Level 1 keeps rhyme-family neighbours away; level 3 slips one in; level 4
  // fills the screen with them, because telling "bee" from "dee" and "pee" is
  // the whole difficulty once the shapes themselves are known.
  const sameFamily = allowed.filter((l) => sameRhymeFamily(l, target))
  const otherFamily = allowed.filter((l) => !sameRhymeFamily(l, target))
  const ordered =
    level === 1
      ? [...shuffle(otherFamily), ...shuffle(sameFamily)]
      : level === 3
        ? [...shuffle(sameFamily).slice(0, 1), ...shuffle(otherFamily), ...shuffle(sameFamily).slice(1)]
        : level === 4
          ? [...shuffle(sameFamily), ...shuffle(otherFamily)]
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

/**
 * Gives a chosen letter its share of the round. Replaces items from the end
 * of the pick, never the opening easy wins, and never touches a round in
 * which the letter does not exist yet.
 */
function applyFocus(
  picked: readonly Candidate[],
  candidates: readonly Candidate[],
  focus: LetterId | undefined,
): readonly Candidate[] {
  if (!focus) return picked
  const candidate = candidates.find((c) => c.letter === focus)
  if (!candidate) return picked
  const wanted = Math.round(picked.length * TUNING.town.focusShare)
  const have = picked.filter((c) => c.letter === focus).length
  if (have >= wanted) return picked
  const result = [...picked]
  let toReplace = wanted - have
  for (let i = result.length - 1; i >= 0 && toReplace > 0; i -= 1) {
    if (result[i].letter === focus) continue
    result[i] = candidate
    toReplace -= 1
  }
  return result
}

/** Spreads repeats apart and puts safe items at the start and the end. */
function arrange(picked: readonly Candidate[]): readonly Candidate[] {
  const easy = picked.filter((c) => c.bucket === 'easy')
  const rest = shuffle(picked.filter((c) => c.bucket !== 'easy'))
  const opening = easy.slice(0, Math.min(2, easy.length))
  const closing = easy.slice(opening.length, opening.length + 1)
  const spare = shuffle(easy.slice(opening.length + closing.length))

  // Interleave rather than shuffle together: five unfamiliar letters in a row
  // is how a child decides they are bad at this. Every hard item gets an easy
  // one after it whenever there is one left.
  const middle: Candidate[] = []
  let hard = 0
  let soft = 0
  while (hard < rest.length || soft < spare.length) {
    if (hard < rest.length) middle.push(rest[hard++])
    if (soft < spare.length) middle.push(spare[soft++])
  }

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
  const modeIds = availableModes(profile, options)
  // A lesson names its letters and introduces them itself; free play follows
  // the curriculum's pacing.
  const fresh = options.letters
    ? options.letters.filter((letter) => !profile.introduced.includes(letter))
    : nextIntroductions(profile, now, options.letterPool)
  const letters = options.letters ? [...options.letters] : [...profile.introduced, ...fresh]
  // Early on there are only a handful of letters. A full-length round would
  // just ask about the same three over and over.
  const length = Math.max(
    4,
    Math.min(options.length ?? TUNING.sessionLength, letters.length * 3),
  )

  if (letters.length === 0 || modeIds.length === 0) {
    return { items: [], introduced: [] }
  }

  // Each exercise has its own ceiling, declared in the mode registry.
  const modeUsage = new Map<ModeId, number>()
  // Mode quotas are scaled to the number of candidates, not to the round
  // length: one candidate is built per letter, and the round is drawn from
  // them, so a quota counted in items would be exhausted long before the last
  // letter got a say.
  // Shuffled, because mode quotas are filled in order: with the letters in a
  // fixed sequence the first half of the alphabet would take every production
  // slot and the second half would only ever be tapped.
  const candidates = buildCandidates(
    profile,
    shuffle(letters),
    modeIds,
    now,
    options,
    modeUsage,
    letters.length,
  )
  // A reading-only round with no readable letter still has to be a round.
  if (candidates.length === 0) {
    if (options.modeIds && options.modeIds.length > 0) {
      return buildSession(profile, now, { ...options, modeIds: undefined })
    }
    return { items: [], introduced: fresh }
  }

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

  // When there is nothing weak to review, the nominal weak and review slots go
  // begging and the round would fill up with easy wins. That is precisely the
  // situation of a child who already knows most of the alphabet: the letters
  // they are missing are all "new", and those are what the round is for. Hand
  // the spare slots to them, up to half the round.
  const newCap = Math.round(length * TUNING.mix.newShareCap)
  const alreadyNew = picked.filter((c) => c.bucket === 'new').length
  if (picked.length < length && alreadyNew < newCap) {
    picked.push(...takeFrom(pool, 'new', Math.min(newCap - alreadyNew, length - picked.length)))
  }

  // Padding. Brand-new letters are excluded here: beyond the cap above, a
  // round of first encounters teaches nothing. The rest is material the child
  // has already met, weakest first.
  // Draw from what is left in the pool before repeating anything already
  // picked, otherwise the same three letters come back all round and drag
  // their exercise with them.
  // Ties broken at random: when every letter is equally well known, a stable
  // sort would hand the whole round to whichever exercises came first.
  const unused = shuffle(pool.filter((c) => c.bucket !== 'new')).sort((a, b) => a.p - b.p)
  const repeats = picked.filter((c) => c.bucket !== 'new')
  const fillPool = [
    ...unused,
    ...(repeats.length > 0 ? repeats : candidates.filter((c) => c.bucket !== 'new')),
  ]
  let guard = 0
  while (picked.length < length && fillPool.length > 0 && guard < length * 4) {
    picked.push(fillPool[guard % fillPool.length])
    guard += 1
  }

  // A lesson made of brand-new letters is the one place where a round of
  // first encounters is the point: the letters get met, then recognised
  // among others, then typed and traced, all inside the same lesson.
  if (options.letters && picked.length < length) {
    picked.push(...lessonFollowUps(candidates, modeIds, length - picked.length))
  }

  const arranged = firstMeetingFirst(
    arrange(applyFocus(picked.slice(0, length), candidates, options.focus)),
  )

  const usedWords = new Set<string>()
  const items = arranged.map((candidate, index): SessionItem => {
    const mode = MODES[candidate.modeId]
    const itemLevel = pickLevel(candidate, options.level ?? options.difficulty)
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
      // Once the shapes themselves are known, sorting A from a on the same
      // screen is where the remaining difficulty lives.
      mixedCaseOptions: itemLevel >= 3 && options.caseMode === 'mixed',
      reason: candidate.bucket,
      ...readingFields(profile, candidate, itemLevel, now, usedWords, options),
      ...(candidate.modeId === 'twinLetters'
        ? { twin: twinFor(profile, candidate.letter, now) ?? undefined }
        : {}),
    }
  })

  return { items, introduced: fresh }
}

/**
 * A letter is met before it is asked for: the gentle first question on a new
 * letter is moved ahead of any other question on it. Same letter, same
 * neighbours, so the spacing the arrangement worked out is untouched.
 */
function firstMeetingFirst(ordered: readonly Candidate[]): readonly Candidate[] {
  const out = [...ordered]
  const seen = new Set<LetterId>()
  out.forEach((candidate, index) => {
    if (candidate.bucket !== 'new' || seen.has(candidate.letter)) return
    seen.add(candidate.letter)
    if (GENTLE.includes(candidate.modeId)) return
    const gentleAt = out.findIndex(
      (other, j) => j > index && other.letter === candidate.letter && GENTLE.includes(other.modeId),
    )
    if (gentleAt < 0) return
    out[index] = out[gentleAt]
    out[gentleAt] = candidate
  })
  return out
}

/**
 * Second and third meetings with the letters of a lesson. The first pass asks
 * the child to pick the letter out among others; the second asks them to
 * produce it. Both cycle through the lesson's games in turn, so twelve items
 * over four letters are three different questions per letter.
 */
function lessonFollowUps(
  candidates: readonly Candidate[],
  modeIds: readonly ModeId[],
  count: number,
): readonly Candidate[] {
  const fresh = candidates.filter((c) => c.bucket === 'new')
  if (fresh.length === 0) return []
  const plain = (id: ModeId) => !READING_MODES.includes(id) && id !== 'twinLetters'
  const recognise = modeIds.filter((id) => plain(id) && !DEMANDING.includes(id) && !GENTLE.includes(id))
  const produce = modeIds.filter((id) => plain(id) && DEMANDING.includes(id))
  const passes = [
    recognise.length > 0 ? recognise : modeIds.filter(plain),
    produce.length > 0 ? produce : recognise.length > 0 ? recognise : modeIds.filter(plain),
  ]
  const out: Candidate[] = []
  let pass = 0
  while (out.length < count && pass < 6) {
    const modes = passes[Math.min(pass, passes.length - 1)]
    if (modes.length === 0) break
    fresh.forEach((candidate, index) => {
      if (out.length >= count) return
      const modeId = modes[(index + pass) % modes.length]
      out.push({ ...candidate, modeId, skill: MODES[modeId].skill })
    })
    pass += 1
  }
  return out
}

/**
 * The word behind a reading item, chosen for the focus letter at the level's
 * position, plus the wrong pictures. A word is not repeated within a round.
 */
function readingFields(
  profile: Profile,
  candidate: Candidate,
  level: Level,
  now: number,
  usedWords: Set<string>,
  options: BuildOptions,
): Partial<SessionItem> {
  const modeId = candidate.modeId
  if (!READING_MODES.includes(modeId)) return {}
  const letter = candidate.letter
  const picturesOnly = modeId !== 'buildWord'
  const mode = MODES[modeId]

  const isVowel = SHORT_VOWELS.includes(letter)
  const wanted: GapPosition =
    modeId !== 'missingLetter'
      ? 'any'
      : isVowel
        ? level >= 3
          ? 'vowel'
          : 'first'
        : level === 1
          ? 'first'
          : level === 2
            ? Math.random() < 0.5
              ? 'first'
              : 'last'
            : 'any'

  const continuantOnly = modeId === 'blendIt' && level <= 2
  const stages = options.wordStages
  const pick = (position: GapPosition) =>
    wordsForLetter(profile, now, { letter, position, picturesOnly, continuantOnly, stages }).find(
      (word) => !usedWords.has(word.id),
    )
  const word = pick(wanted) ?? pick('any')
  if (!word) return {}
  usedWords.add(word.id)

  const fields: { -readonly [K in keyof SessionItem]?: SessionItem[K] } = { wordId: word.id }
  if (modeId === 'missingLetter') {
    fields.gapIndex = gapIndexFor(word, letter, wanted) ?? gapIndexFor(word, letter, 'any') ?? 0
  }
  if (modeId === 'readPick' || modeId === 'blendIt') {
    const pool = wordsForLetter(profile, now, { letter, picturesOnly: true, stages }).concat(
      WORDS.filter(
        (w) => w.picture !== 'none' && (stages ? stages.includes(w.stage) : wordUnlocked(profile, w)),
      ),
    )
    fields.wordDistractors = wordDistractorsFor(
      word,
      Math.max(1, mode.options(level) - 1),
      pool,
      level === 1 ? 'none' : level === 2 ? 'onset' : 'vowel',
    )
    if (modeId === 'blendIt') {
      // A two-syllable word is joined by syllables, not by sounds.
      fields.segmentation = word.syllables.length > 1 ? 'syllable' : level >= 3 ? 'phoneme' : 'onsetRime'
    }
  }
  return fields
}

/**
 * Level for one question.
 *
 * On automatic difficulty each letter gets the level it has earned: a shaky
 * letter is asked among three tiles, a settled one among six. A fixed level
 * still steps down for a brand-new letter, because a first encounter among six
 * distractors is just a guaranteed failure.
 */
function pickLevel(candidate: Candidate, difficulty: Difficulty): Level {
  if (difficulty === 'auto') {
    if (candidate.bucket === 'new' || candidate.bucket === 'weak') return 1
    if (candidate.stability >= TUNING.expertHalfLifeDays) return 4
    if (candidate.stability >= TUNING.solidHalfLifeDays) return 3
    if (candidate.stability >= TUNING.settledHalfLifeDays) return 2
    return 1
  }

  // A chosen level is a choice: the parent asked for twelve tiles and gets
  // twelve tiles. The one concession is a single step down for a letter the
  // child has never met or is currently losing, so that a first meeting is
  // still a meeting and not a lottery.
  if (candidate.bucket === 'new' || candidate.bucket === 'weak') {
    return Math.max(1, difficulty - 1) as Level
  }
  return difficulty
}
