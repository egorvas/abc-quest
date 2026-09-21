import { useMemo, useRef, useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LETTER_IDS, letterInfo } from '../data/letters'
import { allStatuses, masteredCount } from '../engine/mastery'
import { SKILLS, SKILL_IDS, cellKey } from '../engine/skills'
import { NEW_CELL, recall } from '../engine/memory'
import { migrate } from '../storage/schema'
import { storeSizeBytes, storageIsPersistent } from '../storage/store'
import { townCompletion } from '../engine/town'
import { speechRecognitionSupported } from '../speech/recognizer'
import { ttsSupported } from '../audio/speak'
import { LEVEL_COUNT, currentLevel, levelsDone, tierOf } from '../engine/levels'
import './ParentsScreen.css'

interface ParentsScreenProps {
  readonly onBack: () => void
  readonly onEditKnown: () => void
}

/**
 * The parent screen, behind a small arithmetic gate so a four-year-old does
 * not wander in and switch the microphone off.
 *
 * Everything shown here is derived from the records the engine already keeps;
 * nothing extra is stored to produce it.
 */
export function ParentsScreen({ onBack, onEditKnown }: ParentsScreenProps) {
  const { profile, store, updateSettings, importStore, saveFailed, skipLevels, restartLevels } = useGame()
  const [unlocked, setUnlocked] = useState(false)
  const [answer, setAnswer] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const gate = useMemo(() => {
    const a = 3 + Math.floor(Math.random() * 6)
    const b = 2 + Math.floor(Math.random() * 6)
    return { a, b, sum: a + b }
  }, [])

  const now = Date.now()
  const statuses = useMemo(
    () => (profile ? allStatuses(profile, LETTER_IDS, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  )

  if (!profile) return null

  if (!unlocked) {
    return (
      <Screen className="parents">
        <TopBar
          left={
            <Button size="sm" tone="ghost" onPress={onBack}>
              ← Back
            </Button>
          }
        />
        <div className="parents__gate">
          <p className="parents__gate-title">For grown-ups</p>
          <p className="parents__gate-sum">
            {gate.a} + {gate.b} = ?
          </p>
          <input
            className="parents__gate-input"
            inputMode="numeric"
            value={answer}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '')
              setAnswer(value)
              if (Number(value) === gate.sum) setUnlocked(true)
            }}
          />
        </div>
      </Screen>
    )
  }

  const learned = masteredCount(statuses)
  const inPlay = profile.introduced.length
  const familiar = statuses.filter(
    (s) => s.stage === 'strong' || s.stage === 'mastered',
  ).length
  const poolValue =
    profile.settings.letterPool === 'auto' ? 'auto' : String(profile.settings.letterPool)
  const weakest = [...statuses]
    .filter((s) => s.stage !== 'locked' && s.stage !== 'mastered')
    .sort((a, b) => a.recall - b.recall)
    .slice(0, 6)

  const totalSeconds = profile.sessions.reduce((sum, s) => sum + s.seconds, 0)
  const totalItems = profile.sessions.reduce((sum, s) => sum + s.items, 0)
  const totalCorrect = profile.sessions.reduce((sum, s) => sum + s.correct, 0)

  const perSkill = SKILL_IDS.map((skill) => {
    const values = LETTER_IDS.flatMap((letter) => {
      const cases = SKILLS[skill].caseSensitive ? (['upper', 'lower'] as const) : (['upper'] as const)
      return cases.map((glyphCase) => {
        const cell = profile.cells[cellKey(letter, skill, glyphCase)] ?? NEW_CELL
        return cell.n > 0 ? recall(cell, now) : null
      })
    }).filter((value): value is number => value !== null)
    return {
      skill,
      label: SKILLS[skill].label,
      average: values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length,
      touched: values.length,
    }
  })

  const exportProfile = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `abc-quest-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const importFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        const next = migrate(parsed)
        if (next.profiles.length === 0) {
          window.alert('No profiles in that file')
          return
        }
        importStore(next)
        window.alert(`Loaded ${next.profiles.length} profile(s)`)
      } catch {
        window.alert('Could not read that file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Screen className="parents">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack}>
            ← Back
          </Button>
        }
        center={<span className="parents__title">{profile.name}</span>}
      />

      <div className="parents__body">
        <section className="pcard">
          <h2 className="pcard__h">Progress</h2>
          <div className="pcard__row">
            <div className="pstat">
              <b>{learned}</b>
              <span>letters mastered</span>
            </div>
            <div className="pstat">
              <b>{profile.introduced.length}</b>
              <span>letters in play</span>
            </div>
            <div className="pstat">
              <b>{profile.stones}</b>
              <span>days played</span>
            </div>
            <div className="pstat">
              <b>{Math.round(totalSeconds / 60)}</b>
              <span>minutes total</span>
            </div>
            <div className="pstat">
              <b>{totalItems === 0 ? '—' : `${Math.round((totalCorrect / totalItems) * 100)}%`}</b>
              <span>right first time</span>
            </div>
            <div className="pstat">
              <b>{townCompletion(profile.town).owned}/{townCompletion(profile.town).total}</b>
              <span>town built</span>
            </div>
            <div className="pstat">
              <b>{profile.seedsEarned}</b>
              <span>coins earned</span>
            </div>
          </div>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Weakest letters</h2>
          {weakest.length === 0 ? (
            <p className="pcard__muted">Nothing yet. Play a first round.</p>
          ) : (
            <div className="pweak">
              {weakest.map((status) => (
                <div key={status.letter} className="pweak__item">
                  <span className="pweak__glyph">{status.letter}</span>
                  <span className="pweak__bar">
                    <span
                      className="pweak__fill"
                      style={{ width: `${Math.round(status.recall * 100)}%` }}
                    />
                  </span>
                  <span className="pweak__word">{letterInfo(status.letter).word}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pcard">
          <h2 className="pcard__h">By skill</h2>
          <div className="pskills">
            {perSkill.map((row) => (
              <div key={row.skill} className="pskill">
                <span className="pskill__label">{row.label}</span>
                <span className="pweak__bar">
                  <span
                    className="pweak__fill pweak__fill--blue"
                    style={{ width: `${Math.round(row.average * 100)}%` }}
                  />
                </span>
                <span className="pskill__n">{row.touched}</span>
              </div>
            ))}
          </div>
          <p className="pcard__muted">
            Recognition grows fast and fades just as fast. Naming and writing are
            the ones that actually stick.
          </p>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">What is known already</h2>
          <p className="pcard__muted">
            {inPlay} of 26 letters are in play, {familiar} of them familiar. Tick the
            ones the child already recognises: those become easy wins and the rounds
            go to the rest.
          </p>
          <div className="pcard__actions">
            <Button onPress={onEditKnown} tone="amber" size="sm">
              ✎ Tick the known letters
            </Button>
          </div>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Levels</h2>
          <p className="pcard__muted">
            {levelsDone(profile)} of {LEVEL_COUNT} passed.{' '}
            {currentLevel(profile)
              ? `Next: level ${currentLevel(profile)} (${tierOf(currentLevel(profile) ?? 1).title}).`
              : 'The climb is finished and the whole town is open.'}{' '}
            A child who already knows the letters can skip ahead; skipped levels
            count as passed with one star and pay no coins.
          </p>
          <div className="pcard__actions">
            <Button onPress={() => skipLevels(5)} tone="amber" size="sm">
              ⏩ Skip 5 levels
            </Button>
            <Button onPress={() => skipLevels(1)} tone="ghost" size="sm">
              ⏩ Skip 1
            </Button>
            <Button
              onPress={() => {
                if (window.confirm('Start again from level 1? Coins and the town are kept.')) restartLevels()
              }}
              tone="danger"
              size="sm"
            >
              ↺ Restart from level 1
            </Button>
          </div>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">How many letters at once</h2>
          <Choice
            value={poolValue}
            options={[
              { value: 'auto', label: 'One by one', note: 'a new letter once the last ones settle' },
              { value: '8', label: '8' },
              { value: '16', label: '16' },
              { value: '26', label: 'All 26' },
            ]}
            onChange={(value) =>
              updateSettings({ letterPool: value === 'auto' ? 'auto' : Number(value) })
            }
          />
          <p className="pcard__muted">
            One by one is for starting from nothing. A fixed set keeps that many
            letters active at once and the engine picks the weakest out of them,
            which is what a child who knows almost everything needs.
          </p>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Upper and lower case</h2>
          <Choice
            value={profile.settings.caseMode}
            options={[
              { value: 'mixed', label: 'Both' },
              { value: 'upper', label: 'A B C only' },
              { value: 'lower', label: 'a b c only' },
            ]}
            onChange={(value) =>
              updateSettings({ caseMode: value as typeof profile.settings.caseMode })
            }
          />
          <p className="pcard__muted">
            In the mixed mode upper and lower case are two separate memory cells and
            the weaker one gets asked. A letter seen for the very first time always
            starts as a capital.
          </p>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Difficulty</h2>
          <Choice
            value={String(profile.settings.difficulty)}
            options={[
              { value: 'auto', label: 'Automatic', note: 'per letter, as it is earned' },
              { value: '1', label: 'Easy', note: '3 options' },
              { value: '2', label: 'Medium', note: '4 options' },
              { value: '3', label: 'Hard', note: '8 options' },
              { value: '4', label: 'Expert', note: '12, cases mixed' },
            ]}
            onChange={(value) =>
              updateSettings({
                difficulty: value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3 | 4),
              })
            }
          />
          <p className="pcard__muted">
            Difficulty changes how many options are on screen, the size of the hunt
            field, the number of pairs to match and the keyboard layout. A fixed
            level applies to every letter; only a letter the child has never met,
            or is currently losing, steps down by one level for that question.
          </p>
          <p className="pcard__muted">
            Expert is for a child who already reads the alphabet. Twelve tiles at a
            time with capitals and lowercase mixed on the same screen, the letter
            they confuse it with always among the options, rhyming names crowded
            together, the QWERTY keyboard, tracing with no outline to follow, and
            most of the round spent saying, typing or writing letters rather than
            tapping them.
          </p>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Other</h2>
          <Toggle
            label="Microphone (the Say the letter game)"
            value={profile.settings.micEnabled}
            onChange={(micEnabled) => updateSettings({ micEnabled })}
            note={speechRecognitionSupported() ? undefined : 'This browser cannot recognise speech'}
          />
          <Toggle
            label="Sound"
            value={profile.settings.soundEnabled}
            onChange={(soundEnabled) => updateSettings({ soundEnabled })}
            note={ttsSupported() ? undefined : 'This browser cannot speak the letters'}
          />
          <Toggle
            label="QWERTY keyboard instead of ABC"
            value={profile.settings.keyboardLayout === 'qwerty'}
            onChange={(on) => updateSettings({ keyboardLayout: on ? 'qwerty' : 'abc' })}
          />
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Data</h2>
          <p className="pcard__muted">
            Progress lives only in this browser ({Math.round(storeSizeBytes(store) / 1024)} KB).
            {storageIsPersistent()
              ? ' Safari on iPad may erase site data after about a week without opening it. Add the page to the home screen and keep a backup.'
              : ' Storage is unavailable: progress will not survive closing this tab.'}
            {saveFailed ? ' The last save failed.' : ''}
          </p>
          <div className="pcard__actions">
            <Button onPress={exportProfile} tone="ghost" size="sm">
              ⬇ Save a copy
            </Button>
            <Button onPress={() => fileRef.current?.click()} tone="ghost" size="sm">
              ⬆ Load a copy
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="parents__file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importFile(file)
              e.target.value = ''
            }}
          />
        </section>
      </div>
    </Screen>
  )
}

interface ChoiceOption {
  readonly value: string
  readonly label: string
  readonly note?: string
}

interface ChoiceProps {
  readonly value: string
  readonly options: readonly ChoiceOption[]
  readonly onChange: (value: string) => void
}

/** A row of mutually exclusive buttons, easier to read than a select on iPad. */
function Choice({ value, options, onChange }: ChoiceProps) {
  return (
    <div className="pchoice" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`pchoice__btn ${value === option.value ? 'pchoice__btn--on' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <span className="pchoice__label">{option.label}</span>
          {option.note ? <span className="pchoice__note">{option.note}</span> : null}
        </button>
      ))}
    </div>
  )
}

interface ToggleProps {
  readonly label: string
  readonly value: boolean
  readonly onChange: (value: boolean) => void
  readonly note?: string
}

function Toggle({ label, value, onChange, note }: ToggleProps) {
  return (
    <label className="ptoggle">
      <span className="ptoggle__label">
        {label}
        {note ? <em className="ptoggle__note">{note}</em> : null}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="ptoggle__input"
      />
      <span className={`ptoggle__switch ${value ? 'ptoggle__switch--on' : ''}`} />
    </label>
  )
}
