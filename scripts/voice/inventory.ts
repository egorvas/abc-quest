/**
 * Every line of speech the app can say, derived from the app's own data.
 *
 * Nothing is duplicated here: letters, sounds and words are imported from
 * src/data, so adding a word to words.ts adds its clips to the next build and
 * changing an association word regenerates exactly the clips that used it.
 *
 * A clip is specified in one of three ways:
 *
 *  - `text`     ordinary English, phonemised by Kokoro's own G2P. Right for
 *               sentences and whole words.
 *  - `phonemes` explicit IPA. Right wherever G2P is wrong, which is every
 *               bare letter name and every isolated phoneme.
 *  - `parts`    a mix: plain strings are phonemised, `{ ph }` fragments are
 *               inserted verbatim. This is how "Find the letter, B." keeps
 *               sentence prosody while still saying the letter's NAME rather
 *               than reading the glyph.
 *
 * `cut` says how the vowel the engine adds to a consonant is removed again:
 * see cut_at_voicing and cut_at_opening in synth.py.
 */
import { LETTERS, letterInfo, type LetterId } from '../../src/data/letters'
import { GRAPHEMES, LETTER_SOUNDS, type Phoneme } from '../../src/data/phonics'
import { WORDS, type WordEntry } from '../../src/data/words'

/**
 * How a consonant clip is rescued from the vowel the engine adds to it.
 *
 *  - `voicing` cuts where the voice starts. Right for a stop, whose schwa is
 *    deliberately asked for, and for a voiceless fricative, whose vowel the
 *    engine adds by itself.
 *  - `opening` cuts where the energy above 900 Hz jumps, which is the mouth
 *    opening. Right for /m/, /l/, /z/ and the rest, which are voiced from
 *    their first frame so voicing says nothing.
 *  - `keep` is how much survives past the cut, in milliseconds.
 *  - `hold` is the length a continuant is looped up to, so it lasts long
 *    enough for a child to hear it as "mmm" rather than a blip.
 */
export interface CutSpec {
  readonly mode: 'voicing' | 'opening'
  readonly keep: number
  readonly hold?: number
}

export interface ClipSpec {
  readonly id: string
  readonly text?: string
  readonly phonemes?: string
  readonly parts?: readonly (string | { readonly ph: string })[]
  readonly cut?: CutSpec
}

/** Kokoro/misaki spellings for the phoneme symbols phonics.ts uses. */
const IPA: Readonly<Record<Phoneme, string>> = {
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'ɡ', f: 'f', v: 'v',
  θ: 'θ', ð: 'ð', s: 's', z: 'z', ʃ: 'ʃ', ʒ: 'ʒ', 'tʃ': 'ʧ', 'dʒ': 'ʤ',
  m: 'm', n: 'n', ŋ: 'ŋ', l: 'l', r: 'ɹ', w: 'w', j: 'j', h: 'h',
  æ: 'æ', ɛ: 'ɛ', ɪ: 'ɪ', ɑ: 'ɑ', ʌ: 'ʌ', ə: 'ə', i: 'i', u: 'u', ʊ: 'ʊ', ɔ: 'ɔ',
}

/**
 * IPA for the 26 letter NAMES.
 *
 * Not derivable from anything in src: a letter's name is a word, and the one
 * English word a grapheme-to-phoneme engine is most likely to get wrong. The
 * table is written out so it can be read and argued with.
 */
export const LETTER_NAME_IPA: Readonly<Record<LetterId, string>> = {
  A: 'ˈeɪ', B: 'bˈiː', C: 'sˈiː', D: 'dˈiː', E: 'ˈiː', F: 'ˈɛf', G: 'ʤˈiː',
  H: 'ˈeɪʧ', I: 'ˈaɪ', J: 'ʤˈeɪ', K: 'kˈeɪ', L: 'ˈɛl', M: 'ˈɛm', N: 'ˈɛn',
  O: 'ˈoʊ', P: 'pˈiː', Q: 'kjˈuː', R: 'ˈɑɹ', S: 'ˈɛs', T: 'tˈiː', U: 'jˈuː',
  V: 'vˈiː', W: 'ˌdʌbəljˈuː', X: 'ˈɛks', Y: 'wˈaɪ', Z: 'zˈiː',
}

/**
 * How much voicing a stop may keep after its release, in milliseconds.
 *
 * Measured, not guessed. A voiceless stop carries its own aspiration, so 90 ms
 * is already a clear /p/ with no vowel colour. A voiced stop has almost no
 * aspiration: cut at 70 ms it measured 80 ms of audio in total and was barely
 * a click, so b, d and g get 120 ms - still short of the ~150 ms at which a
 * listener starts to hear a schwa.
 */
const STOP_KEEP_MS: Readonly<Partial<Record<Phoneme, number>>> = {
  b: 120, d: 120, g: 120,
  p: 90, t: 90, k: 90,
  'dʒ': 110, 'tʃ': 110,
}

/** How long a held consonant should last once it has been looped. */
const HOLD_MS = 320

/** Consonants that have no voice of their own, so the vowel is easy to spot. */
const VOICELESS: ReadonlySet<Phoneme> = new Set<Phoneme>(['f', 's', 'ʃ', 'θ', 'h'])

/**
 * Turn a grapheme's phonemes into something the engine can actually say.
 *
 * A continuant is written with length marks and comes out pure: /fːː/ is a
 * held f and nothing else. A stop physically cannot be produced without
 * releasing into a vowel, so it is asked for as consonant + schwa and the
 * schwa is cut off again in synth.py.
 */
const VOWELS = 'æɛɪɑʌəiuʊɔ'
const HOLDABLE: ReadonlySet<Phoneme> = new Set<Phoneme>([
  'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j', 'h',
])

function soundSpec(phonemes: readonly Phoneme[]): { phonemes: string; cut?: CutSpec } {
  const body = phonemes.map((p) => IPA[p]).join('')
  const last = phonemes[phonemes.length - 1]

  // A vowel is stressed so the model does not reduce it to a schwa, and is the
  // one sound that needs no rescuing: it is what it is.
  if (VOWELS.includes(IPA[phonemes[0]])) return { phonemes: `ˈ${body}` }

  // A cluster that ends in a glide - q says /kw/ - cannot be held: holding it
  // would hold the /w/ and turn it into "koo". It is treated as a stop, with a
  // schwa asked for and cut at the point the /w/ opens into it.
  if (phonemes.length > 1 && (last === 'w' || last === 'j')) {
    return { phonemes: `${body}ə`, cut: { mode: 'opening', keep: 30 } }
  }

  // A consonant that can be held is asked for long, then cut at the vowel the
  // engine adds anyway, then looped back up to a length a child can hear.
  if (HOLDABLE.has(last)) {
    return {
      phonemes: `${body}ːː`,
      cut: {
        mode: VOICELESS.has(last) ? 'voicing' : 'opening',
        keep: VOICELESS.has(last) ? 10 : 20,
        hold: HOLD_MS,
      },
    }
  }

  // A stop cannot be produced without releasing into a vowel, so it is asked
  // for with a schwa and the schwa is cut off again. Never held: a stop that
  // lasts 300 ms is not a stop.
  return {
    phonemes: `${body}ə`,
    cut: { mode: 'voicing', keep: STOP_KEEP_MS[last] ?? 90 },
  }
}

const ph = (value: string) => ({ ph: value } as const)
const name = (letter: LetterId) => ph(LETTER_NAME_IPA[letter])

/**
 * Per-letter prompt sentences. One entry per distinct line in src/modes and
 * src/screens; the ids are what voice.ts asks for.
 *
 * The comma before a letter name is deliberate. It buys a short pause, and
 * that pause is the difference between "Find the letter B" arriving as an
 * instruction and arriving as one blurred word.
 */
export const SENTENCES: readonly {
  readonly id: string
  readonly parts: (letter: LetterId) => readonly (string | { readonly ph: string })[]
}[] = [
  { id: 'find', parts: (L) => ['Find the letter,', name(L), '.'] },
  { id: 'findall', parts: (L) => ['Find all the letters,', name(L), '.'] },
  { id: 'type', parts: (L) => ['Type the letter,', name(L), '.'] },
  { id: 'trace', parts: (L) => ['Trace the letter,', name(L), '.'] },
  { id: 'isfor', parts: (L) => [name(L), '.', name(L), `is for ${letterInfo(L).word}.`] },
  { id: 'traced', parts: (L) => [name(L), '.', name(L), `for ${letterInfo(L).word}.`] },
  { id: 'whichletter', parts: (L) => [`${letterInfo(L).word}.`, 'Which letter?'] },
  { id: 'isforwhat', parts: (L) => [name(L), '.', name(L), 'is for...'] },
  { id: 'same', parts: (L) => [name(L), 'and', name(L), '. The same letter.'] },
]

/*
 * There is deliberately no "soundword" sentence here.
 *
 * FirstSound's second-miss line is the sound, a pause, then the word. Inside
 * one utterance the stop would have to keep its schwa, because the schwa is cut
 * by looking at the whole clip and a sentence has more clip after it. Played as
 * two clips the pause is real speech anyway, so nothing is lost and /b/ stays
 * a /b/. voice.ts composes it in speakSoundWord().
 */

/** Lines that do not depend on a letter or a word. */
export const GLOBAL_LINES: readonly { readonly id: string; readonly text: string }[] = [
  { id: 'ask/whatletter', text: 'What letter is this?' },
  { id: 'ask/whichone', text: 'Which one is this?' },
  { id: 'ask/whatword', text: 'What word is this?' },
  { id: 'hint/tryagain', text: 'Try again!' },
  { id: 'hint/oncemore', text: 'I did not catch that. Try once more!' },
  { id: 'hint/nomic', text: 'No microphone here. Let us say it together.' },
  { id: 'hint/followfinger', text: 'Follow the letter with your finger.' },
  { id: 'hint/tapspeaker', text: 'Tap the glowing speaker.' },
  { id: 'hint/sayitwithme', text: 'Say it with me.' },
  { id: 'hint/repeatafterme', text: 'Repeat after me.' },
  { id: 'hint/lookcarefully', text: 'These two look alike. Look carefully.' },
  { id: 'praise/nice', text: 'Nice!' },
  { id: 'praise/welldone', text: 'Well done!' },
  { id: 'praise/youdidit', text: 'You did it!' },
  { id: 'praise/great', text: 'Great job!' },
  // The confusable-pair explanations from TwinLetters.
  { id: 'twin/bd', text: 'b has its tummy at the back. d has its tummy at the front.' },
  { id: 'twin/pq', text: 'p has its ball on the right. q has its ball on the left.' },
  { id: 'twin/mw', text: 'M points down. W points up.' },
  { id: 'twin/cg', text: 'G is a C with a little shelf.' },
  { id: 'twin/uv', text: 'U is round at the bottom. V is pointy.' },
  { id: 'twin/ef', text: 'E has three arms. F has two.' },
]

/**
 * A word said slowly with its sounds run together - "mmmaaan" - then said
 * whole. Stretching is done on the phonemes, not by slowing playback, because
 * a slowed-down whole word still has the gaps that break blending.
 */
function blendPhonemes(word: WordEntry): string {
  const stretched = word.units
    .map((unit) => {
      const info = GRAPHEMES.find(
        (g) => g.g === unit.g && g.p.join('+') === unit.p.join('+'),
      )
      const body = unit.p.map((p) => IPA[p]).join('')
      return info?.continuant ? `${body}ːː` : body
    })
    .join('')
  return `${stretched}.`
}

/** Unique syllables across the whole word list, for the onset-rime drills. */
export function syllableSet(): readonly string[] {
  const all = new Set<string>()
  for (const word of WORDS) for (const s of word.syllables) all.add(s)
  return [...all].sort()
}

/**
 * Every distinct sound the app can play, as clip key -> phonemes.
 *
 * Taken from GRAPHEMES, plus the one letter sound no single grapheme spells:
 * q says /kw/, and there is no grapheme "q" in phonics.ts because qu is what
 * actually appears in words.
 */
export function soundClips(): readonly (readonly [string, readonly Phoneme[]])[] {
  const out: [string, readonly Phoneme[]][] = GRAPHEMES.map((g) => [g.clip, g.p])
  out.push(['q', ['k', 'w']])
  return out
}

/** The clip that plays a letter's own sound. */
export const LETTER_SOUND_CLIP: Readonly<Record<LetterId, string>> = Object.fromEntries(
  (Object.keys(LETTER_SOUNDS) as LetterId[]).map((L) => {
    const want = LETTER_SOUNDS[L].phoneme.join('+')
    if (want === 'k+w') return [L, 'q'] as const
    const match = GRAPHEMES.find((g) => g.g === L.toLowerCase() && g.p.join('+') === want)
      ?? GRAPHEMES.find((g) => g.p.join('+') === want)
    return [L, match?.clip ?? L.toLowerCase()] as const
  }),
) as Record<LetterId, string>

export function buildInventory(): readonly ClipSpec[] {
  const clips: ClipSpec[] = []

  for (const letter of LETTERS) {
    const L = letter.id
    clips.push({ id: `name/${L}`, phonemes: LETTER_NAME_IPA[L] })
    clips.push({ id: `word/${L}`, text: `${letter.word}.` })
    for (const sentence of SENTENCES) {
      clips.push({ id: `say/${sentence.id}/${L}`, parts: sentence.parts(L) })
    }
  }

  // Sounds are keyed on the grapheme's clip name, never on the letter: c, k
  // and ck are one sound and must be one file. A letter finds its clip through
  // LETTER_SOUND_CLIP below.
  const seenSound = new Set<string>()
  for (const [clip, phonemes] of soundClips()) {
    if (seenSound.has(clip)) continue
    seenSound.add(clip)
    const spec = soundSpec(phonemes)
    clips.push({ id: `sound/${clip}`, phonemes: spec.phonemes, cut: spec.cut })
  }

  for (const line of GLOBAL_LINES) clips.push({ id: line.id, text: line.text })

  for (const word of WORDS) {
    clips.push({ id: `read/word/${word.id}`, text: `${word.text}.` })
    clips.push({ id: `read/blend/${word.id}`, phonemes: blendPhonemes(word) })
  }
  for (const syllable of syllableSet()) {
    clips.push({ id: `read/syl/${syllable}`, text: `${syllable}.` })
  }

  const seen = new Set<string>()
  return clips.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}
