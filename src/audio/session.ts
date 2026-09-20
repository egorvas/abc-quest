/**
 * iOS audio session and screen wake lock.
 *
 * Two device behaviours would otherwise ruin a session with a child:
 *
 * 1. Web Audio and speech synthesis both map to the "ambient" audio category
 *    by default, which the ringer switch and Control Center mute silence
 *    completely, with no way to detect it from script. Declaring the session as
 *    "playback" is what keeps sound alive. It has to be set before the audio
 *    context is created, and re-asserted after an interruption.
 * 2. The iPad dims and locks while a child is thinking. Wake Lock fixes that,
 *    but it needs a real touch, is released on every hide, and did not work at
 *    all in home-screen web apps before iPadOS 18.4 - so failure is expected
 *    and must be silent.
 */

interface AudioSessionLike {
  type: string
}

function audioSession(): AudioSessionLike | null {
  const nav = navigator as unknown as { audioSession?: AudioSessionLike }
  return nav.audioSession ?? null
}

export function claimPlaybackSession(): void {
  const session = audioSession()
  if (!session) return
  try {
    session.type = 'playback'
  } catch {
    /* Safari-only API; other browsers do not need it */
  }
}

let wakeLock: { release: () => Promise<void>; released: boolean } | null = null

export async function keepScreenAwake(): Promise<void> {
  try {
    const anyNav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<typeof wakeLock & object> }
    }
    if (!anyNav.wakeLock) return
    if (wakeLock && !wakeLock.released) return
    wakeLock = (await anyNav.wakeLock.request('screen')) as typeof wakeLock
  } catch {
    // Rejected in home-screen apps on older iPadOS, and whenever the page is
    // not visible. Nothing to do about it.
  }
}

/**
 * Re-asserts both after the system takes them away: backgrounding, a phone
 * call, Siri, or a GPU process restart all leave the page silent otherwise.
 */
export function watchAudioSession(): () => void {
  const reassert = () => {
    if (document.visibilityState !== 'visible') return
    claimPlaybackSession()
    void keepScreenAwake()
  }
  document.addEventListener('visibilitychange', reassert)
  window.addEventListener('pageshow', reassert)
  return () => {
    document.removeEventListener('visibilitychange', reassert)
    window.removeEventListener('pageshow', reassert)
  }
}
