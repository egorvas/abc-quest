import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'

/**
 * What a speech recogniser actually returns when a small child says a single
 * English letter.
 *
 * Recognisers are tuned for words, not letters. Twenty-five of the twenty-six
 * letter names are one syllable and they cluster into near-identical families
 * (the "E set" B C D E G P T V Z, the "A set" A J K, the nasals M N, the
 * fricatives F S X), so open 26-way classification is hopeless. Safari also
 * exposes no grammar or phrase biasing.
 *
 * The app always knows which letter it asked for, so this is a yes/no test
 * against one target rather than a classification. That removes nearly all of
 * the cross-letter confusion.
 *
 * `ACCEPT` is safe to count as correct for that target. `CONFUSABLE` is what
 * the engine tends to return instead: used only to say "not quite, try again",
 * never to accept.
 */

export const ACCEPT: Readonly<Record<LetterId, readonly string[]>> = {
  A: ['a', 'ay', 'aye', 'eh', 'ah', 'hey', 'hay', 'ei', 'eight', 'ate', 'ae'],
  B: ['b', 'be', 'bee', 'bea', 'bi', 'beep', 'bees'],
  C: ['c', 'see', 'sea', 'cee', 'si', 'ci', 'seed', 'cd'],
  D: ['d', 'dee', 'de', 'dea', 'di', 'the'],
  E: ['e', 'ee', 'eee', 'ea', 'he', 'hee', 'each', 'eat'],
  F: ['f', 'ef', 'eff', 'if', 'of', 'ff', 'efe'],
  G: ['g', 'gee', 'ge', 'jee', 'ghee', 'geez', 'jeez'],
  H: ['h', 'aitch', 'aich', 'haitch', 'hache', 'age', 'ache', 'etch'],
  I: ['i', 'eye', 'aye', 'ai', 'hi', 'high', 'ay'],
  J: ['j', 'jay', 'jai', 'jae', 'jaye', 'gay', 'jah'],
  K: ['k', 'kay', 'kae', 'cay', 'quay', 'ok', 'okay', 'o k', 'kai', 'ka'],
  L: ['l', 'el', 'ell', 'elle', 'al', 'ale', 'hell', 'yell'],
  M: ['m', 'em', 'emm', 'am', 'him', 'hm', 'mm', 'emma'],
  N: ['n', 'en', 'enn', 'in', 'an', 'and', 'un', 'ian'],
  O: ['o', 'oh', 'owe', 'ow', 'ooh', 'oo', 'zero', 'eau'],
  P: ['p', 'pee', 'pea', 'pe', 'peep', 'peas', 'pi'],
  Q: ['q', 'cue', 'queue', 'kyu', 'ku', 'que', 'cu', 'kew', 'coup'],
  R: ['r', 'ar', 'are', 'arr', 'our', 'hour', 'err', 'aar'],
  S: ['s', 'es', 'ess', 'as', 'yes', 'sss', 'esse'],
  T: ['t', 'tee', 'tea', 'te', 'ti', 'tt'],
  U: ['u', 'you', 'yu', 'ewe', 'yew', 'ya', 'hue', 'hugh', 'ooh'],
  V: ['v', 'vee', 've', 'vi', 'we', 'vie', 'veep'],
  W: [
    'w', 'double u', 'double you', 'double u', 'double yu', 'doubleu',
    'doubleyou', 'dubya', 'dub', 'double v',
  ],
  X: ['x', 'ex', 'eks', 'ecks', 'axe', 'ax', 'exe', 'excess', 'x ray', 'xray'],
  Y: ['y', 'why', 'wye', 'wai', 'wy', 'wi', 'yi'],
  Z: ['z', 'zee', 'zed', 'ze', 'zi', 'zeb', 'xi', 'these', 'zeta'],
}

/** What the engine is likely to hear instead. Worth a retry, not a pass. */
export const CONFUSABLE: Readonly<Record<LetterId, readonly LetterId[]>> = {
  A: ['H', 'J', 'K', 'I'],
  B: ['V', 'P', 'D', 'E', 'G', 'C', 'T', 'Z'],
  C: ['D', 'E', 'G', 'P', 'T', 'V', 'Z', 'B', 'S'],
  D: ['B', 'E', 'G', 'P', 'T', 'V', 'C', 'Z'],
  E: ['B', 'C', 'D', 'G', 'P', 'T', 'V', 'Z'],
  F: ['S', 'X', 'L', 'M', 'N'],
  G: ['J', 'Z', 'D', 'T', 'V', 'B', 'C', 'E', 'P'],
  H: ['A', 'K'],
  I: ['Y', 'A'],
  J: ['G', 'K', 'A'],
  K: ['A', 'J', 'Q'],
  L: ['M', 'N', 'F', 'S', 'R'],
  M: ['N', 'L'],
  N: ['M', 'L'],
  O: ['W', 'U'],
  P: ['B', 'T', 'D', 'E', 'G', 'C', 'V', 'Z'],
  Q: ['U', 'K', 'W'],
  R: ['L', 'A'],
  S: ['F', 'X', 'C', 'Z'],
  T: ['B', 'C', 'D', 'E', 'G', 'P', 'V', 'Z'],
  U: ['Q', 'W', 'O'],
  V: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'Z'],
  W: ['U', 'O', 'Y'],
  X: ['S', 'F'],
  Y: ['I', 'W'],
  Z: ['C', 'D', 'E', 'G', 'T', 'V', 'B', 'S'],
}

/** Transcripts that genuinely belong to two letters at once. */
const AMBIGUOUS = new Set(['a', 'i', 'ay', 'aye', 'ai', 'ei', 'ooh', 'oo'])

const FILLERS = /^(the|a|letter|its|it's|that's|thats|i said|say|um|uh|er)\s+/

export function normalizeTranscript(raw: string): string {
  let text = raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Safari capitalises and adds a trailing period; children add "it's a...".
  let previous = ''
  while (previous !== text) {
    previous = text
    text = text.replace(FILLERS, '')
  }
  return text
}

/** The association word counts too: "ball" is easier to recognise than "bee". */
function acceptedFor(letter: LetterId): readonly string[] {
  const info = letterInfo(letter)
  return [...ACCEPT[letter], info.word.toLowerCase(), info.lower]
}

export type SpeechVerdict =
  | { readonly kind: 'match' }
  /** Understood, but a different letter - feeds the confusion map. */
  | { readonly kind: 'other'; readonly heard: LetterId }
  | { readonly kind: 'unknown'; readonly heard: string }

/**
 * Decides whether any alternative the recogniser offered is the target letter.
 *
 * Ambiguity resolves in the child's favour: "ai" could be A or I, and if the
 * target is I, it counts.
 */
export function judgeTranscripts(
  target: LetterId,
  transcripts: readonly string[],
): SpeechVerdict {
  const accepted = new Set(acceptedFor(target))
  let heardOther: LetterId | null = null
  let lastText = ''

  for (const raw of transcripts) {
    const text = normalizeTranscript(raw)
    if (!text) continue
    lastText = text

    const tokens = [text, ...text.split(' ')]
    for (const token of tokens) {
      if (accepted.has(token)) return { kind: 'match' }
    }

    if (heardOther === null) {
      for (const candidate of CONFUSABLE[target]) {
        const candidateWords = new Set(acceptedFor(candidate))
        const hit = tokens.find(
          (token) => candidateWords.has(token) && !AMBIGUOUS.has(token),
        )
        if (hit) {
          heardOther = candidate
          break
        }
      }
    }
  }

  if (heardOther) return { kind: 'other', heard: heardOther }
  return { kind: 'unknown', heard: lastText }
}
