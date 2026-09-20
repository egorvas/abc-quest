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
import { speechRecognitionSupported } from '../speech/recognizer'
import { ttsSupported } from '../audio/speak'
import './ParentsScreen.css'

interface ParentsScreenProps {
  readonly onBack: () => void
}

/**
 * The parent screen, behind a small arithmetic gate so a four-year-old does
 * not wander in and switch the microphone off.
 *
 * Everything shown here is derived from the records the engine already keeps;
 * nothing extra is stored to produce it.
 */
export function ParentsScreen({ onBack }: ParentsScreenProps) {
  const { profile, store, updateSettings, importStore, saveFailed } = useGame()
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
              ← Назад
            </Button>
          }
        />
        <div className="parents__gate">
          <p className="parents__gate-title">Для родителей</p>
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
      label: SKILLS[skill].labelRu,
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
          window.alert('В файле нет профилей')
          return
        }
        importStore(next)
        window.alert(`Загружено профилей: ${next.profiles.length}`)
      } catch {
        window.alert('Не удалось прочитать файл')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Screen className="parents">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack}>
            ← Назад
          </Button>
        }
        center={<span className="parents__title">{profile.name}</span>}
      />

      <div className="parents__body">
        <section className="pcard">
          <h2 className="pcard__h">Прогресс</h2>
          <div className="pcard__row">
            <div className="pstat">
              <b>{learned}</b>
              <span>букв освоено</span>
            </div>
            <div className="pstat">
              <b>{profile.introduced.length}</b>
              <span>букв введено</span>
            </div>
            <div className="pstat">
              <b>{profile.stones}</b>
              <span>дней с игрой</span>
            </div>
            <div className="pstat">
              <b>{Math.round(totalSeconds / 60)}</b>
              <span>минут всего</span>
            </div>
            <div className="pstat">
              <b>{totalItems === 0 ? '—' : `${Math.round((totalCorrect / totalItems) * 100)}%`}</b>
              <span>верных ответов</span>
            </div>
          </div>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Самые слабые буквы</h2>
          {weakest.length === 0 ? (
            <p className="pcard__muted">Пока нет данных — сыграйте первый раунд.</p>
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
          <h2 className="pcard__h">По навыкам</h2>
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
            Узнавание растёт быстро и осыпается так же быстро. «Называет» и «Пишет» — то,
            что действительно держится.
          </p>
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Настройки</h2>
          <Toggle
            label="Микрофон (режим «Скажи букву»)"
            value={profile.settings.micEnabled}
            onChange={(micEnabled) => updateSettings({ micEnabled })}
            note={speechRecognitionSupported() ? undefined : 'Браузер не поддерживает распознавание'}
          />
          <Toggle
            label="Звук"
            value={profile.settings.soundEnabled}
            onChange={(soundEnabled) => updateSettings({ soundEnabled })}
            note={ttsSupported() ? undefined : 'Браузер не умеет произносить буквы'}
          />
          <Toggle
            label="Строчные буквы"
            value={profile.settings.lowercaseEnabled}
            onChange={(lowercaseEnabled) => updateSettings({ lowercaseEnabled })}
          />
          <Toggle
            label="Клавиатура QWERTY вместо ABC"
            value={profile.settings.keyboardLayout === 'qwerty'}
            onChange={(on) => updateSettings({ keyboardLayout: on ? 'qwerty' : 'abc' })}
          />
        </section>

        <section className="pcard">
          <h2 className="pcard__h">Данные</h2>
          <p className="pcard__muted">
            Прогресс хранится только в этом браузере ({Math.round(storeSizeBytes(store) / 1024)} КБ).
            {storageIsPersistent()
              ? ' Safari на iPad может стереть данные сайта примерно через неделю без открытия — добавьте страницу на домашний экран и делайте резервную копию.'
              : ' Хранилище недоступно: прогресс не сохранится после закрытия вкладки.'}
            {saveFailed ? ' Последнее сохранение не удалось.' : ''}
          </p>
          <div className="pcard__actions">
            <Button onPress={exportProfile} tone="ghost" size="sm">
              ⬇ Сохранить копию
            </Button>
            <Button onPress={() => fileRef.current?.click()} tone="ghost" size="sm">
              ⬆ Загрузить копию
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
