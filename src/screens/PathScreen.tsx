import { useEffect, useMemo, useRef } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { pathProgress, pathView, type LessonView } from '../engine/path'
import { MODES } from '../modes/registry'
import { sfx } from '../audio/sfx'
import './PathScreen.css'

interface PathScreenProps {
  readonly onBack: () => void
  readonly onLesson: (lessonId: string) => void
}

/**
 * The path, top to bottom: units as sections, lessons as stepping stones.
 *
 * Done lessons show their stars and can be replayed for more; the current
 * one glows; locked ones are visible but grey, so the child can see what is
 * coming without being able to skip to it. It scrolls to the current lesson
 * on open, because on a long path that is the only place worth looking.
 */
export function PathScreen({ onBack, onLesson }: PathScreenProps) {
  const { profile } = useGame()
  const currentRef = useRef<HTMLButtonElement>(null)

  const units = useMemo(() => (profile ? pathView(profile) : []), [profile])
  const progress = useMemo(
    () => (profile ? pathProgress(profile) : { done: 0, total: 0 }),
    [profile],
  )

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  if (!profile) return null

  const open = (view: LessonView) => {
    if (view.state === 'locked') {
      sfx('wrong')
      return
    }
    sfx('tap')
    onLesson(view.lesson.id)
  }

  return (
    <Screen className="path">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Home">
            🏠
          </Button>
        }
        center={<span className="path__title">Reading path</span>}
        right={
          <span className="path__progress">
            {progress.done} / {progress.total}
          </span>
        }
      />
      <div className="path__scroll">
        {units.map((unit) => (
          <section
            key={unit.unit.id}
            className={`path__unit ${unit.done ? 'path__unit--done' : ''}`}
          >
            <header className="path__unit-head">
              <span className="path__unit-emoji">{unit.unit.emoji}</span>
              <div>
                <h2 className="path__unit-title">{unit.unit.title}</h2>
                <p className="path__unit-blurb">{unit.unit.blurb}</p>
              </div>
            </header>
            <ol className="path__lessons">
              {unit.lessons.map((view, index) => (
                <li
                  key={view.lesson.id}
                  className={`path__step path__step--${index % 4}`}
                >
                  <button
                    ref={view.state === 'current' ? currentRef : undefined}
                    type="button"
                    className={`path__node path__node--${view.state}`}
                    onClick={() => open(view)}
                    aria-label={`${view.lesson.title}, ${view.state}`}
                    aria-disabled={view.state === 'locked'}
                  >
                    <span className="path__node-face">
                      {view.state === 'locked'
                        ? '🔒'
                        : view.state === 'current'
                          ? '▶︎'
                          : '✓'}
                    </span>
                    <span className="path__node-title">{view.lesson.title}</span>
                    <span className="path__node-games">
                      {view.lesson.modes.slice(0, 4).map((id) => MODES[id].emoji).join(' ')}
                    </span>
                    <span className="path__stars" aria-label={`${view.stars} of 3 stars`}>
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={`path__star ${view.stars >= n ? 'path__star--on' : ''}`}
                        >
                          ★
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <p className="path__end">🎉 That is the whole path. Keep the stars growing!</p>
      </div>
    </Screen>
  )
}
