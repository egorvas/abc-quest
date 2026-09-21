import { buildSession } from '../../src/engine/scheduler'
import { applyAttempt, introduceLetters } from '../../src/engine/apply'
import { newProfile, type Profile } from '../../src/storage/schema'
import { LEVEL_COUNT, levelSpec, tierOf } from '../../src/data/levels'
import { MODES } from '../../src/modes/registry'
import { finishLevel, coinsForLevel } from '../../src/engine/levels'
import type { Attempt } from '../../src/modes/types'

/**
 * Plays every level once with a child who answers everything right, and
 * prints what each round was made of. Flags a round that came out short or
 * fell back to games outside the level's recipe.
 */
let now = Date.now()
let profile: Profile = newProfile('t', '🐱', now)
let coins = 0
let problems = 0
for (let n = 1; n <= LEVEL_COUNT; n += 1) {
  const spec = levelSpec(n)
  const plan = buildSession(profile, now, {
    modeIds: spec.modes,
    letters: spec.letters,
    wordStages: spec.wordStages,
    level: spec.difficulty,
    ungated: spec.ungated,
    length: spec.length,
    micAvailable: false,
    caseMode: 'mixed',
    letterPool: 'auto',
    difficulty: spec.difficulty,
  })
  profile = introduceLetters(profile, plan.introduced)
  const modes = new Map<string, number>()
  for (const item of plan.items) {
    modes.set(item.modeId, (modes.get(item.modeId) ?? 0) + 1)
    const mode = MODES[item.modeId]
    const attempt: Attempt = {
      item,
      verdict: 'right',
      assisted: false,
      wrongPicks: [],
      responseMs: 2000,
      gamma: mode.gamma(item.level, mode.options(item.level)),
      weight: mode.weight(item.level),
      wordSkill: item.wordId ? (mode.skill === 'sound' ? 'read' : 'read') : undefined,
    }
    profile = applyAttempt(profile, attempt, now)
    now += 6000
  }
  const expected = Math.max(4, Math.min(spec.length, spec.letters.length * 3))
  const outside = plan.items.filter((i) => !spec.modes.includes(i.modeId)).length
  const words = plan.items.filter((i) => i.wordId).length
  const short = plan.items.length < expected
  if (outside > 0 || short) problems += 1
  console.log(
    `${String(n).padStart(2)} ${tierOf(n).emoji} L${spec.difficulty} ${spec.letters.join('')}`.padEnd(40),
    `n=${plan.items.length}/${expected}${short ? ' SHORT' : ''} words=${words}${outside ? ` OUTSIDE=${outside}` : ''}`,
    [...modes].map(([m, c]) => `${MODES[m as keyof typeof MODES].emoji}${c}`).join(' '),
    `| spec: ${spec.modes.join(',')}`,
  )
  coins += coinsForLevel(0, 2)
  profile = finishLevel(profile, n, 2)
  now += 3600_000 * 8
}
console.log(`problems=${problems} coins@2stars=${coins} town lots=${Object.values(profile.town.lots).join('').length} extras=${profile.town.extras.length}`)
