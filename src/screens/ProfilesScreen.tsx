import { useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import './ProfilesScreen.css'

const AVATARS = ['🐣', '🦊', '🐼', '🐸', '🦉', '🐙', '🦄', '🐝', '🐧', '🐨', '🦖', '🐬']

interface ProfilesScreenProps {
  readonly onDone: () => void
  /** The very first run has no profile to go back to. */
  readonly canCancel: boolean
}

/** One iPad, up to a few children: each keeps their own garden. */
export function ProfilesScreen({ onDone, canCancel }: ProfilesScreenProps) {
  const { store, createProfile, selectProfile, deleteProfile } = useGame()
  const [creating, setCreating] = useState(store.profiles.length === 0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])

  const submit = () => {
    createProfile(name, avatar)
    setCreating(false)
    setName('')
    onDone()
  }

  return (
    <Screen className="profiles">
      <TopBar
        left={
          canCancel ? (
            <Button size="sm" tone="ghost" onPress={onDone}>
              ← Назад
            </Button>
          ) : null
        }
        center={<span className="profiles__title">Кто играет?</span>}
      />

      {creating ? (
        <div className="profiles__form">
          <div className="profiles__avatars">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`profiles__avatar ${avatar === emoji ? 'profiles__avatar--on' : ''}`}
                onClick={() => setAvatar(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            className="profiles__input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Имя"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="profiles__actions">
            <Button onPress={submit} size="lg" tone="mint">
              Готово
            </Button>
            {store.profiles.length > 0 ? (
              <Button onPress={() => setCreating(false)} tone="ghost">
                Отмена
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="profiles__list">
          {store.profiles.map((item) => (
            <div key={item.id} className="profiles__card">
              <button
                type="button"
                className="profiles__pick"
                onClick={() => {
                  selectProfile(item.id)
                  onDone()
                }}
              >
                <span className="profiles__card-avatar">{item.avatar}</span>
                <span className="profiles__card-name">{item.name}</span>
                <span className="profiles__card-meta">🌰 {item.seeds}</span>
              </button>
              <button
                type="button"
                className="profiles__remove"
                onClick={() => {
                  if (window.confirm(`Удалить профиль «${item.name}» и весь его прогресс?`)) {
                    deleteProfile(item.id)
                  }
                }}
                aria-label={`Удалить ${item.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          <Button onPress={() => setCreating(true)} size="lg" tone="primary" wide>
            + Новый игрок
          </Button>
        </div>
      )}
    </Screen>
  )
}
