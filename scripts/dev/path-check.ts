import { buildSession } from '../../src/engine/scheduler'
import { applySurvey } from '../../src/engine/apply'
import { newProfile } from '../../src/storage/schema'
import { LESSONS } from '../../src/data/lessons'
import { currentLesson, pathProgress } from '../../src/engine/path'
import { INTRO_ORDER } from '../../src/engine/curriculum'
import { MODES } from '../../src/modes/registry'
import type { LetterId } from '../../src/data/letters'

const now = Date.now()
const known20 = INTRO_ORDER.slice(0, 20) as LetterId[]

for (const [label, known, level] of [
  ['fresh', [], 'none'],
  ['knows20-letters', known20, 'letters'],
  ['knows26-words', [...INTRO_ORDER], 'words'],
  ['knows26-syllables', [...INTRO_ORDER], 'syllables'],
] as const) {
  const p = applySurvey(newProfile('t', '🐱', now), known as LetterId[], level, now)
  const cur = currentLesson(p)
  console.log(`\n== ${label}: progress ${JSON.stringify(pathProgress(p))}, current=${cur?.id}`)
  for (const lesson of LESSONS.filter((l) => l.id === cur?.id || ['letters-6', 'blend-1', 'words-2', 'digraphs-2', 'syllables-1', 'read-3'].includes(l.id))) {
    const plan = buildSession(p, now, {
      modeIds: lesson.modes,
      letters: lesson.letters,
      wordStages: lesson.wordStages,
      level: lesson.level,
      length: lesson.length,
      micAvailable: false,
      caseMode: 'mixed',
      letterPool: 'auto',
      difficulty: 4,
    })
    const summary = plan.items.map((i) => `${i.modeId}:${i.letter}${i.wordId ? '/' + i.wordId : ''}@L${i.level}(${MODES[i.modeId].options(i.level)})`)
    console.log(`  ${lesson.id} [${lesson.letters.join('')}] n=${plan.items.length} intro=${plan.introduced.join('')}\n    ${summary.join(' ')}`)
  }
}
