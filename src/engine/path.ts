import type { LetterId } from '../data/letters'
import { LESSONS, UNITS, lessonsOf, type Lesson, type UnitId } from '../data/lessons'
import type { Profile, ReadingLevel } from '../storage/schema'
import { letterStatus } from './mastery'

/**
 * The lesson path: what is done, what is next, what is still locked.
 *
 * A lesson is passed the moment it is finished - the softness policy holds
 * here too, there is no failing a lesson - and the stars say how cleanly.
 * Stars are never taken away; replaying can only raise them.
 */

export type LessonState = 'done' | 'current' | 'locked'

export interface LessonView {
  readonly lesson: Lesson
  readonly state: LessonState
  readonly stars: number
}

export interface UnitView {
  readonly unit: (typeof UNITS)[number]
  readonly lessons: readonly LessonView[]
  readonly done: boolean
}

export function starsFor(correct: number, total: number): number {
  if (total === 0) return 1
  const share = correct / total
  return share >= 0.9 ? 3 : share >= 0.65 ? 2 : 1
}

export function completeLesson(profile: Profile, id: string, stars: number): Profile {
  const previous = profile.path[id] ?? 0
  return { ...profile, path: { ...profile.path, [id]: Math.max(previous, stars) } }
}

/** The first lesson on the path that is not done. Null when the path is finished. */
export function currentLesson(profile: Profile): Lesson | null {
  return LESSONS.find((lesson) => !(profile.path[lesson.id] > 0)) ?? null
}

export function nextLessonAfter(profile: Profile, id: string): Lesson | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === id)
  return LESSONS.slice(index + 1).find((lesson) => !(profile.path[lesson.id] > 0)) ?? currentLesson(profile)
}

export function pathView(profile: Profile): readonly UnitView[] {
  const current = currentLesson(profile)
  return UNITS.map((unit) => {
    const lessons = lessonsOf(unit.id).map((lesson): LessonView => {
      const stars = profile.path[lesson.id] ?? 0
      const state: LessonState = stars > 0 ? 'done' : lesson.id === current?.id ? 'current' : 'locked'
      return { lesson, state, stars }
    })
    return { unit, lessons, done: lessons.every((l) => l.state === 'done') }
  })
}

export function pathProgress(profile: Profile): { readonly done: number; readonly total: number } {
  return {
    done: LESSONS.filter((lesson) => profile.path[lesson.id] > 0).length,
    total: LESSONS.length,
  }
}

/**
 * Where the path starts for a child who already knows things.
 *
 * Marked letters pass the letter and sound lessons they cover; the reading
 * level passes whole units below it. A passed lesson gets one star, not
 * three: it was vouched for, not earned, and the child can come back for the
 * rest.
 */
export function autoPassLessons(
  profile: Profile,
  known: readonly LetterId[],
  level: ReadingLevel,
  now: number,
): Profile {
  const knownSet = new Set(known)
  const unitsPassed: readonly UnitId[] =
    level === 'fluent'
      ? ['letters', 'sounds', 'blend', 'words', 'digraphs', 'syllables']
      : level === 'syllables'
        ? ['letters', 'sounds', 'blend', 'words', 'digraphs']
        : level === 'words'
          ? ['letters', 'sounds', 'blend', 'words']
          : level === 'letters'
            ? ['sounds']
            : []

  let next = profile
  for (const lesson of LESSONS) {
    if (next.path[lesson.id] > 0) continue
    const coveredByLetters =
      (lesson.unit === 'letters' || lesson.unit === 'sounds') &&
      lesson.letters.every(
        (letter) => knownSet.has(letter) || letterStatus(next, letter, now).stage === 'mastered',
      )
    if (coveredByLetters || unitsPassed.includes(lesson.unit)) {
      next = completeLesson(next, lesson.id, 1)
    }
  }
  return next
}
