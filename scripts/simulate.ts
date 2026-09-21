/**
 * Offline simulation of the learning engine.
 *
 * Plays the app as a synthetic child so the curve can be inspected without an
 * iPad: how fast letters are introduced, when the first gold stars appear, and
 * how big the saved profile gets.
 *
 *   npx tsx scripts/simulate.ts [days] [roundsPerDay] [accuracy] [knownAtStart] [pool]
 *
 * `knownAtStart` marks that many letters as already familiar, the way the
 * "which letters do you already know" screen does, and `pool` is the letter
 * pool setting ("auto" or a count). Together they reproduce the case that
 * matters most: a child who knows twenty letters and needs six.
 */
import { buildSession } from '../src/engine/scheduler'
import {
  applyAttempt,
  finishRound,
  introduceLetters,
  placeKnownLetters,
} from '../src/engine/apply'
import { allStatuses, masteredCount } from '../src/engine/mastery'
import { nutsForRound } from '../src/engine/nuts'
import { buyItem, nextPurchase, townCompletion } from '../src/engine/town'
import { newProfile, type Profile } from '../src/storage/schema'
import { LETTER_IDS } from '../src/data/letters'
import { MODES } from '../src/modes/registry'
import type { Attempt, Verdict } from '../src/modes/types'
import { DAY_MS } from '../src/engine/tuning'

const days = Number(process.argv[2] ?? 21)
const roundsPerDay = Number(process.argv[3] ?? 2)
/** Probability the child answers a letter they actually know. */
const skill = Number(process.argv[4] ?? 0.85)
const knownAtStart = Number(process.argv[5] ?? 0)
const poolArg = process.argv[6] ?? 'auto'
const letterPool = poolArg === 'auto' ? ('auto' as const) : Number(poolArg)

let profile: Profile = newProfile('Sim', '🤖', Date.now() - days * DAY_MS)
let now = profile.createdAt

/** How well the synthetic child knows each letter, 0..1. */
const competence = new Map<string, number>()

if (knownAtStart > 0) {
  // The placement screen, as a parent would answer it: the easy letters first.
  const known = ['O', 'S', 'A', 'M', 'T', 'I', 'C', 'E', 'K', 'B', 'D', 'P',
    'R', 'N', 'L', 'F', 'H', 'G', 'J', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Q']
    .slice(0, knownAtStart) as never
  profile = placeKnownLetters(profile, known, now)
  for (const letter of known as unknown as string[]) competence.set(letter, 0.8)
}

const totals = {
  items: 0,
  byCase: { upper: 0, lower: 0 } as Record<string, number>,
  byMode: {} as Record<string, number>,
  byLevel: {} as Record<number, number>,
}

function play(): void {
  const plan = buildSession(profile, now, {
    micAvailable: true,
    caseMode: 'mixed',
    letterPool,
    difficulty: 'auto',
  })
  if (plan.items.length === 0) return
  profile = introduceLetters(profile, plan.introduced)
  const before = profile

  let correct = 0
  let assisted = 0
  const letters = new Set<string>()
  totals.items += plan.items.length

  for (const item of plan.items) {
    totals.byCase[item.glyphCase] += 1
    totals.byMode[item.modeId] = (totals.byMode[item.modeId] ?? 0) + 1
    totals.byLevel[item.level] = (totals.byLevel[item.level] ?? 0) + 1
    const mode = MODES[item.modeId]
    const gamma = mode.gamma(item.level, mode.options(item.level))
    // The synthetic child actually learns: competence in a letter grows each
    // time it comes up. Without that the simulation would punish the scheduler
    // for drilling exactly the letters it is supposed to drill.
    const familiarity = competence.get(item.letter) ?? 0
    const chance = familiarity * skill + (1 - familiarity * skill) * gamma
    const roll = Math.random()
    const verdict: Verdict = roll < chance ? 'right' : roll < chance + 0.1 ? 'almost' : 'miss'
    const wasAssisted = verdict === 'miss'

    const attempt: Attempt = {
      item,
      // A missed item is always reached in the end: the game reveals it.
      verdict: verdict === 'miss' ? 'almost' : verdict,
      assisted: wasAssisted,
      wrongPicks: verdict === 'miss' && item.distractors.length > 0 ? [item.distractors[0]] : [],
      responseMs: 1500 + Math.random() * 4000,
      gamma,
      weight: mode.weight(item.level),
    }
    // Seeing the answer teaches something even when the answer was wrong.
    competence.set(
      item.letter,
      Math.min(1, familiarity + (verdict === 'right' ? 0.09 : 0.05)),
    )
    profile = applyAttempt(profile, attempt, now)
    if (verdict === 'right') correct += 1
    if (wasAssisted) assisted += 1
    letters.add(item.letter)
    now += 6000
  }

  const award = nutsForRound(
    before,
    profile,
    { items: plan.items.length, correct, letters: [...letters] as never },
    now,
    rng,
  )
  profile = finishRound(
    profile,
    {
      items: plan.items.length,
      correct,
      assisted,
      seconds: plan.items.length * 6,
      letters: [...letters] as never,
      nuts: award.total,
    },
    now,
  )
  // The synthetic child spends like a real one: whatever is buyable, at once.
  for (let guard = 0; guard < 4; guard += 1) {
    const target = nextPurchase(profile, now)
    if (!target) break
    profile = buyItem(profile, target.letter, target.slot, now)
  }
}

/** Deterministic, so two runs with the same arguments print the same curve. */
let seed = 12345
function rng(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const rows: string[] = []
for (let day = 1; day <= days; day += 1) {
  for (let round = 0; round < roundsPerDay; round += 1) {
    play()
    now += 20 * 60 * 1000
  }
  const statuses = allStatuses(profile, LETTER_IDS, now)
  const mastered = masteredCount(statuses)
  const strong = statuses.filter((s) => s.stage === 'strong').length
  const learning = statuses.filter((s) => s.stage === 'learning').length
  rows.push(
    `day ${String(day).padStart(2)}  introduced ${String(profile.introduced.length).padStart(2)}` +
      `  learning ${String(learning).padStart(2)}  strong ${String(strong).padStart(2)}` +
      `  mastered ${String(mastered).padStart(2)}  nuts earned ${String(profile.seedsEarned).padStart(3)}  town ${townCompletion(profile.town).owned}/78`,
  )
  // Next day.
  now = profile.createdAt + day * DAY_MS + 16 * 60 * 60 * 1000
}

console.log(rows.join('\n'))
const bytes = new TextEncoder().encode(JSON.stringify(profile)).length
console.log(
  `\ncells ${Object.keys(profile.cells).length}` +
    `  confusion pairs ${Object.keys(profile.confusion).length}` +
    `  sessions kept ${profile.sessions.length}` +
    `  profile size ${(bytes / 1024).toFixed(1)} KB`,
)
console.log(`introduction order used: ${profile.introduced.join(' ')}`)

const share = (n: number) => `${Math.round((n / Math.max(1, totals.items)) * 100)}%`
console.log(
  `case split: ABC ${share(totals.byCase.upper)} / abc ${share(totals.byCase.lower)}`,
)
console.log(
  'levels: ' +
    [1, 2, 3, 4].map((l) => `L${l} ${share(totals.byLevel[l] ?? 0)}`).join("  "),
)
console.log(
  'modes: ' +
    Object.entries(totals.byMode)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${id} ${share(n)}`)
      .join('  '),
)
