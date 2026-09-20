/**
 * Offline simulation of the learning engine.
 *
 * Plays the app as a synthetic child so the curve can be inspected without an
 * iPad: how fast letters are introduced, when the first gold stars appear, and
 * how big the saved profile gets.
 *
 *   npx tsx scripts/simulate.ts [days] [roundsPerDay] [accuracy]
 */
import { buildSession } from '../src/engine/scheduler'
import { applyAttempt, finishRound, introduceLetters } from '../src/engine/apply'
import { allStatuses, masteredCount } from '../src/engine/mastery'
import { seedsForRound } from '../src/engine/garden'
import { newProfile, type Profile } from '../src/storage/schema'
import { LETTER_IDS } from '../src/data/letters'
import { MODES } from '../src/modes/registry'
import type { Attempt, Verdict } from '../src/modes/types'
import { DAY_MS } from '../src/engine/tuning'

const days = Number(process.argv[2] ?? 21)
const roundsPerDay = Number(process.argv[3] ?? 2)
/** Probability the child answers a letter they actually know. */
const skill = Number(process.argv[4] ?? 0.85)

let profile: Profile = newProfile('Sim', '🤖', Date.now() - days * DAY_MS)
let now = profile.createdAt

function play(): void {
  const plan = buildSession(profile, now, {
    micAvailable: true,
    lowercaseEnabled: true,
  })
  if (plan.items.length === 0) return
  profile = introduceLetters(profile, plan.introduced)

  let correct = 0
  let assisted = 0
  const letters = new Set<string>()

  for (const item of plan.items) {
    const mode = MODES[item.modeId]
    const gamma = mode.gamma(item.level, mode.options(item.level))
    // A familiar letter is answered well; an unfamiliar one falls back to luck.
    const familiarity = item.reason === 'new' ? 0 : item.reason === 'weak' ? 0.45 : 0.9
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
    profile = applyAttempt(profile, attempt, now)
    if (verdict === 'right') correct += 1
    if (wasAssisted) assisted += 1
    letters.add(item.letter)
    now += 6000
  }

  profile = finishRound(
    profile,
    {
      items: plan.items.length,
      correct,
      assisted,
      seconds: plan.items.length * 6,
      letters: [...letters] as never,
      seeds: seedsForRound(correct, plan.items.length),
    },
    now,
  )
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
      `  mastered ${String(mastered).padStart(2)}  seeds ${profile.seeds}`,
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
