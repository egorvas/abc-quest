import type { LetterId } from '../data/letters'

/**
 * What a speech recogniser actually returns when a small child says a single
 * English letter. Recognisers are tuned for words, not letters, so almost every
 * letter comes back as a homophone ("bee", "sea", "why") or a near miss.
 *
 * Everything here is lowercase and stripped of punctuation before comparison.
 */
export const LETTER_ALIASES: Readonly<Record<LetterId, readonly string[]>> = {
  A: ['a', 'ay', 'eh', 'hey', 'hay', 'aye', 'ai', 'ae', 'a.'],
  B: ['b', 'bee', 'be', 'bi', 'bea', 'been', 'beep', 'b.'],
  C: ['c', 'see', 'sea', 'si', 'cee', 'ce', 'seat', 'seed', 'c.'],
  D: ['d', 'dee', 'de', 'di', 'the', 'dea', 'deed', 'd.'],
  E: ['e', 'ee', 'eee', 'ea', 'eat', 'each', 'e.'],
  F: ['f', 'ef', 'eff', 'ehf', 'if', 'f.'],
  G: ['g', 'gee', 'jee', 'ji', 'gi', 'jeep', 'geez', 'g.'],
  H: ['h', 'aitch', 'aich', 'ache', 'hatch', 'h.', 'age'],
  I: ['i', 'eye', 'ai', 'aye', 'hi', 'high', 'i.'],
  J: ['j', 'jay', 'jai', 'jae', 'j.', 'jays'],
  K: ['k', 'kay', 'cay', 'okay', 'ka', 'k.'],
  L: ['l', 'el', 'ell', 'elle', 'al', 'hell', 'l.'],
  M: ['m', 'em', 'emm', 'am', 'hm', 'm.'],
  N: ['n', 'en', 'enn', 'an', 'in', 'and', 'n.'],
  O: ['o', 'oh', 'owe', 'ou', 'oo', 'o.'],
  P: ['p', 'pee', 'pea', 'pe', 'pi', 'pee.', 'p.'],
  Q: ['q', 'cue', 'queue', 'kyu', 'ku', 'coo', 'q.'],
  R: ['r', 'ar', 'are', 'arr', 'our', 'hour', 'r.'],
  S: ['s', 'ess', 'es', 'yes', 'as', 'is', 's.'],
  T: ['t', 'tee', 'tea', 'te', 'ti', 'ty', 't.'],
  U: ['u', 'you', 'yu', 'ew', 'ewe', 'yew', 'u.'],
  V: ['v', 'vee', 've', 'we', 'vi', 'v.'],
  W: ['w', 'double u', 'double you', 'doubleu', 'doubleyou', 'dub', 'dubya', 'w.'],
  X: ['x', 'ex', 'ecks', 'eks', 'axe', 'ax', 'x.'],
  Y: ['y', 'why', 'wy', 'wai', 'wine', 'y.'],
  Z: ['z', 'zee', 'zed', 'ze', 'zi', 'said', 'z.'],
}

/** Ambiguous transcripts that could be two different letters. */
const CONTESTED = new Set(['ai', 'aye', 'a', 'i'])

const LOOKUP: ReadonlyMap<string, LetterId[]> = (() => {
  const map = new Map<string, LetterId[]>()
  for (const [letter, aliases] of Object.entries(LETTER_ALIASES)) {
    for (const alias of aliases) {
      const existing = map.get(alias)
      if (existing) existing.push(letter as LetterId)
      else map.set(alias, [letter as LetterId])
    }
  }
  return map
})()

export function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type SpeechVerdict =
  | { readonly kind: 'match' }
  /** Understood, but it is a different letter - useful for the confusion map. */
  | { readonly kind: 'other'; readonly heard: LetterId }
  | { readonly kind: 'unknown'; readonly heard: string }

/**
 * Decides whether any of the recogniser's alternatives is the target letter.
 * Ambiguous transcripts resolve in the child's favour: if "ai" could be A or I
 * and the target is I, it counts.
 */
export function judgeTranscripts(
  target: LetterId,
  transcripts: readonly string[],
): SpeechVerdict {
  const seen: LetterId[] = []
  for (const raw of transcripts) {
    const text = normalizeTranscript(raw)
    if (!text) continue

    const candidates = new Set<LetterId>()
    for (const token of [text, ...text.split(' ')]) {
      for (const letter of LOOKUP.get(token) ?? []) candidates.add(letter)
    }
    // "the letter b" / "letter bee" - strip the carrier phrase.
    const stripped = text.replace(/^(the\s+)?letter\s+/, '')
    for (const letter of LOOKUP.get(stripped) ?? []) candidates.add(letter)

    if (candidates.has(target)) return { kind: 'match' }
    for (const letter of candidates) {
      if (!CONTESTED.has(text)) seen.push(letter)
    }
  }
  if (seen.length > 0) return { kind: 'other', heard: seen[0] }
  const first = transcripts.map(normalizeTranscript).find(Boolean) ?? ''
  return { kind: 'unknown', heard: first }
}
