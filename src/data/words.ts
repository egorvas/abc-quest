import type { LetterId } from './letters'
import { isLetterId } from './letters'
import type { Phoneme } from './phonics'
import { graphemeInfo, isPhoneme } from './phonics'

/**
 * The reading dataset.
 *
 * Every entry is validated at module load: the graphemes must concatenate to
 * the spelling, the syllables must too, and every grapheme-to-phoneme pair
 * must exist in phonics.ts.
 *
 * Word rules, enforced by hand:
 *  - one syllable = one short vowel, spelled with its default grapheme;
 *  - concrete, and inside the spoken vocabulary of a five-year-old learning
 *    English as a second language;
 *  - nothing irregular for its own stage. Words dropped for that reason are
 *    listed in DROPPED with the reason, so nobody adds them back.
 *
 * `picture`: 'exact' means the emoji's own name is the word; 'close' means it
 * depicts the thing but a child may say another word first, so the voice
 * names it once; 'none' means no honest emoji exists, and the word is still
 * used by the modes that do not need a picture.
 */

export type WordId = string

export type WordStage =
  | 'vc' | 'cvc-cont' | 'cvc' | 'cvc-x' | 'digraph' | 'twosyl' | 'blend'

export type Picture = 'exact' | 'close' | 'none'

export interface GraphemeUnit {
  /** Letters as spelled: "sh", "ck", "bb". */
  readonly g: string
  /** What those letters say here. Two entries only for x. */
  readonly p: readonly Phoneme[]
}

export interface WordEntry {
  /** The spelling, lowercase. Also the id. */
  readonly id: WordId
  readonly text: string
  readonly phonemes: readonly Phoneme[]
  /** Grapheme-to-phoneme split; the g's concatenate to the spelling. */
  readonly units: readonly GraphemeUnit[]
  /** Syllables as spelled. */
  readonly syllables: readonly string[]
  readonly emoji: string | null
  readonly picture: Picture
  readonly stage: WordStage
  /** Letters this word practises, in first-appearance order. */
  readonly letters: readonly LetterId[]
  /** The first grapheme can be held and stretched into the vowel. */
  readonly continuantOnset: boolean
  /** Needs adjacent consonants even though it is listed in an earlier stage. */
  readonly needsBlends: boolean
  readonly notes?: string
}

/** `spec` is space-separated grapheme=phoneme, or grapheme=ph+ph for x. */
function parseUnits(spec: string): readonly GraphemeUnit[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [g, ps] = token.split('=')
      if (!g || !ps) throw new Error(`Bad unit "${token}"`)
      const p = ps.split('+')
      for (const one of p) {
        if (!isPhoneme(one)) throw new Error(`Bad phoneme "${one}" in "${token}"`)
      }
      const phonemes = p as readonly Phoneme[]
      graphemeInfo(g, phonemes) // throws on an unknown mapping
      return { g, p: phonemes }
    })
}

function makeWord(
  stage: WordStage,
  spec: string,
  syllables: string,
  emoji: string | null,
  picture: Picture,
  notes?: string,
): WordEntry {
  const units = parseUnits(spec)
  const text = units.map((u) => u.g).join('')
  const syl = syllables.split('-')
  if (syl.join('') !== text) throw new Error(`Syllables "${syllables}" do not spell "${text}"`)
  if ((emoji === null) !== (picture === 'none')) {
    throw new Error(`Picture and emoji disagree for "${text}"`)
  }
  const letters: LetterId[] = []
  for (const unit of units) {
    for (const ch of unit.g.toUpperCase()) {
      if (isLetterId(ch) && !letters.includes(ch)) letters.push(ch)
    }
  }
  const first = units[0]
  return {
    id: text,
    text,
    phonemes: units.flatMap((u) => u.p),
    units,
    syllables: syl,
    emoji,
    picture,
    stage,
    letters,
    continuantOnset: graphemeInfo(first.g, first.p).continuant,
    needsBlends: /needs blend/.test(notes ?? ''),
    notes,
  }
}

const w =
  (stage: WordStage) =>
  (spec: string, syllables: string, emoji: string | null, picture: Picture, notes?: string) =>
    makeWord(stage, spec, syllables, emoji, picture, notes)

// ---- vc: two phonemes. Voice and print, mostly no pictures. ----
const vc = w('vc')
export const WORDS_VC: readonly WordEntry[] = [
  vc('a=æ t=t', 'at', null, 'none'),
  vc('a=æ m=m', 'am', null, 'none'),
  vc('a=æ n=n', 'an', null, 'none'),
  vc('i=ɪ n=n', 'in', null, 'none'),
  vc('i=ɪ t=t', 'it', null, 'none'),
  vc('i=ɪ f=f', 'if', null, 'none'),
  vc('o=ɑ n=n', 'on', null, 'none'),
  vc('u=ʌ p=p', 'up', '⬆️', 'close', 'arrow; the voice names it'),
  vc('u=ʌ s=s', 'us', null, 'none'),
  vc('o=ɑ x=k+s', 'ox', '🐂', 'exact', 'x is two sounds'),
]

// ---- cvc-cont: continuant onsets only. The blending stage. ----
const cc = w('cvc-cont')
export const WORDS_CVC_CONT: readonly WordEntry[] = [
  cc('m=m a=æ n=n', 'man', '👨', 'exact'),
  cc('m=m a=æ p=p', 'map', '🗺️', 'exact'),
  cc('m=m a=æ t=t', 'mat', null, 'none'),
  cc('m=m a=æ d=d', 'mad', null, 'none'),
  cc('m=m u=ʌ d=d', 'mud', null, 'none'),
  cc('m=m u=ʌ g=g', 'mug', null, 'none'),
  cc('s=s u=ʌ n=n', 'sun', '☀️', 'exact'),
  cc('s=s a=æ d=d', 'sad', null, 'none'),
  cc('s=s i=ɪ t=t', 'sit', null, 'none'),
  cc('f=f a=æ n=n', 'fan', '🪭', 'close', 'folding hand fan'),
  cc('f=f i=ɪ t=t', 'fit', null, 'none'),
  cc('f=f u=ʌ n=n', 'fun', null, 'none'),
  cc('f=f i=ɪ g=g', 'fig', null, 'none'),
  cc('n=n e=ɛ t=t', 'net', '🥅', 'close', 'goal net'),
  cc('n=n u=ʌ t=t', 'nut', '🥜', 'close', 'peanuts'),
  cc('n=n a=æ p=p', 'nap', null, 'none'),
  cc('l=l e=ɛ g=g', 'leg', '🦵', 'exact'),
  cc('l=l i=ɪ p=p', 'lip', null, 'none'),
  cc('l=l o=ɑ g=g', 'log', '🪵', 'close', 'emoji name is wood'),
  cc('l=l i=ɪ d=d', 'lid', null, 'none'),
  cc('r=r a=æ t=t', 'rat', '🐀', 'exact'),
  cc('r=r a=æ m=m', 'ram', '🐏', 'exact'),
  cc('r=r e=ɛ d=d', 'red', '🟥', 'close', 'red square'),
  cc('r=r u=ʌ n=n', 'run', '🏃', 'close', 'person running'),
  cc('r=r u=ʌ g=g', 'rug', null, 'none'),
  cc('v=v a=æ n=n', 'van', '🚐', 'exact'),
  cc('v=v e=ɛ t=t', 'vet', null, 'none'),
  cc('z=z i=ɪ p=p', 'zip', null, 'none'),
  cc('h=h a=æ t=t', 'hat', '🎩', 'close', 'top hat'),
  cc('h=h e=ɛ n=n', 'hen', '🐔', 'close', 'emoji name is chicken'),
  cc('h=h u=ʌ t=t', 'hut', '🛖', 'close'),
  cc('h=h u=ʌ g=g', 'hug', '🤗', 'close', 'hugging face'),
  cc('h=h i=ɪ t=t', 'hit', null, 'none'),
  cc('h=h o=ɑ p=p', 'hop', null, 'none'),
  cc('h=h o=ɑ t=t', 'hot', null, 'none'),
  cc('w=w e=ɛ b=b', 'web', '🕸️', 'close', 'spider web'),
  cc('w=w i=ɪ g=g', 'wig', null, 'none'),
  cc('w=w i=ɪ n=n', 'win', null, 'none'),
  cc('w=w e=ɛ t=t', 'wet', null, 'none'),
  cc('y=j e=ɛ s=s', 'yes', null, 'none'),
]

// ---- cvc: stop onsets. The onset is never isolated: "ba", then "bat". ----
const cv = w('cvc')
export const WORDS_CVC: readonly WordEntry[] = [
  cv('b=b a=æ t=t', 'bat', '🦇', 'exact'),
  cv('b=b a=æ g=g', 'bag', '👜', 'close', 'handbag'),
  cv('b=b e=ɛ d=d', 'bed', '🛏️', 'exact'),
  cv('b=b u=ʌ s=s', 'bus', '🚌', 'exact'),
  cv('b=b i=ɪ n=n', 'bin', '🗑️', 'close', 'wastebasket'),
  cv('b=b i=ɪ g=g', 'big', null, 'none'),
  cv('b=b u=ʌ g=g', 'bug', '🐛', 'close'),
  cv('b=b i=ɪ b=b', 'bib', null, 'none'),
  cv('d=d o=ɑ g=g', 'dog', '🐶', 'exact'),
  cv('d=d i=ɪ g=g', 'dig', null, 'none'),
  cv('d=d a=æ d=d', 'dad', null, 'none'),
  cv('g=g u=ʌ m=m', 'gum', null, 'none'),
  cv('k=k i=ɪ d=d', 'kid', '🧒', 'close', 'emoji name is child'),
  cv('k=k i=ɪ t=t', 'kit', null, 'none'),
  cv('c=k a=æ t=t', 'cat', '🐱', 'exact'),
  cv('c=k a=æ p=p', 'cap', '🧢', 'close', 'billed cap'),
  cv('c=k a=æ n=n', 'can', '🥫', 'close', 'canned food'),
  cv('c=k u=ʌ p=p', 'cup', '🥤', 'close', 'cup with straw'),
  cv('c=k u=ʌ t=t', 'cut', null, 'none'),
  cv('p=p i=ɪ g=g', 'pig', '🐷', 'exact'),
  cv('p=p i=ɪ n=n', 'pin', '📌', 'exact'),
  cv('p=p e=ɛ n=n', 'pen', '🖊️', 'exact'),
  cv('p=p o=ɑ t=t', 'pot', '🍲', 'close', 'pot of food'),
  cv('p=p o=ɑ p=p', 'pop', null, 'none'),
  cv('t=t e=ɛ n=n', 'ten', '🔟', 'exact'),
  cv('t=t o=ɑ p=p', 'top', null, 'none'),
  cv('t=t u=ʌ b=b', 'tub', '🛁', 'close', 'bathtub'),
  cv('t=t i=ɪ n=n', 'tin', null, 'none'),
  cv('j=dʒ a=æ m=m', 'jam', null, 'none'),
  cv('j=dʒ o=ɑ b=b', 'job', null, 'none'),
  cv('j=dʒ u=ʌ g=g', 'jug', null, 'none'),
]

// ---- cvc-x: x is one grapheme, two phonemes. ----
const cx = w('cvc-x')
export const WORDS_CVC_X: readonly WordEntry[] = [
  cx('f=f o=ɑ x=k+s', 'fox', '🦊', 'exact'),
  cx('b=b o=ɑ x=k+s', 'box', '📦', 'close', 'package'),
  cx('s=s i=ɪ x=k+s', 'six', '6️⃣', 'exact'),
  cx('m=m i=ɪ x=k+s', 'mix', null, 'none'),
]

// ---- digraph: ck, sh, ng, ch, doubles, and exactly one th. ----
const dg = w('digraph')
export const WORDS_DIGRAPH: readonly WordEntry[] = [
  dg('d=d u=ʌ ck=k', 'duck', '🦆', 'exact'),
  dg('s=s o=ɑ ck=k', 'sock', '🧦', 'close', 'emoji name is socks'),
  dg('r=r o=ɑ ck=k', 'rock', '🪨', 'exact'),
  dg('l=l o=ɑ ck=k', 'lock', '🔒', 'close', 'emoji name is locked'),
  dg('k=k i=ɪ ck=k', 'kick', null, 'none', 'k and ck in one word'),
  dg('n=n e=ɛ ck=k', 'neck', null, 'none'),
  dg('b=b a=æ ck=k', 'back', null, 'none'),
  dg('sh=ʃ i=ɪ p=p', 'ship', '🚢', 'exact'),
  dg('f=f i=ɪ sh=ʃ', 'fish', '🐟', 'exact'),
  dg('sh=ʃ o=ɑ p=p', 'shop', '🏪', 'close', 'convenience store'),
  dg('sh=ʃ e=ɛ ll=l', 'shell', '🐚', 'close', 'spiral shell'),
  dg('r=r i=ɪ ng=ŋ', 'ring', '💍', 'exact'),
  dg('w=w i=ɪ ng=ŋ', 'wing', '🪽', 'close'),
  dg('k=k i=ɪ ng=ŋ', 'king', null, 'none'),
  dg('s=s o=ɑ ng=ŋ', 'song', null, 'none'),
  dg('ch=tʃ i=ɪ ck=k', 'chick', '🐤', 'close', 'baby chick'),
  dg('ch=tʃ i=ɪ n=n', 'chin', null, 'none'),
  dg('ch=tʃ o=ɑ p=p', 'chop', null, 'none'),
  dg('e=ɛ gg=g', 'egg', '🥚', 'exact'),
  dg('b=b e=ɛ ll=l', 'bell', '🔔', 'exact'),
  dg('d=d o=ɑ ll=l', 'doll', null, 'none'),
  dg('h=h i=ɪ ll=l', 'hill', null, 'none'),
  dg('b=b u=ʌ zz=z', 'buzz', null, 'none'),
  dg('m=m i=ɪ ss=s', 'miss', null, 'none'),
  dg('b=b a=æ th=θ', 'bath', '🛁', 'close', 'th will come out as s or f; that is fine'),
]

// ---- twosyl: compounds first, then two closed syllables. ----
const ts = w('twosyl')
export const WORDS_TWOSYL: readonly WordEntry[] = [
  ts('s=s u=ʌ n=n s=s e=ɛ t=t', 'sun-set', '🌇', 'exact'),
  ts('h=h o=ɑ t=t d=d o=ɑ g=g', 'hot-dog', '🌭', 'exact'),
  ts('b=b a=æ th=θ t=t u=ʌ b=b', 'bath-tub', '🛁', 'exact'),
  ts('l=l a=æ p=p t=t o=ɑ p=p', 'lap-top', '💻', 'exact'),
  ts('b=b a=æ ck=k p=p a=æ ck=k', 'back-pack', '🎒', 'exact'),
  ts('c=k o=ɑ b=b w=w e=ɛ b=b', 'cob-web', '🕸️', 'close', 'spider web'),
  ts('c=k a=æ t=t f=f i=ɪ sh=ʃ', 'cat-fish', null, 'none'),
  ts('r=r a=æ bb=b i=ɪ t=t', 'rab-bit', '🐰', 'exact'),
  ts('b=b a=æ s=s k=k e=ə t=t', 'bas-ket', '🧺', 'exact'),
  ts('m=m a=æ g=g n=n e=ə t=t', 'mag-net', '🧲', 'exact'),
  ts('r=r o=ɑ ck=k e=ə t=t', 'rock-et', '🚀', 'exact'),
  ts('t=t i=ɪ ck=k e=ə t=t', 'tick-et', '🎫', 'exact'),
  ts('m=m u=ʌ ff=f i=ɪ n=n', 'muf-fin', '🧁', 'close', 'cupcake'),
  ts('h=h e=ɛ l=l m=m e=ə t=t', 'hel-met', '🪖', 'close', 'military helmet'),
  ts('m=m i=ɪ tt=t e=ə n=n', 'mit-ten', '🧤', 'close', 'emoji name is gloves'),
  ts('t=t e=ɛ nn=n i=ɪ s=s', 'ten-nis', '🎾', 'exact'),
  ts('s=s e=ɛ v=v e=ə n=n', 'sev-en', '7️⃣', 'exact'),
  ts('n=n a=æ p=p k=k i=ɪ n=n', 'nap-kin', null, 'none'),
  ts('p=p i=ɪ c=k n=n i=ɪ c=k', 'pic-nic', null, 'none'),
  ts('s=s u=ʌ n=n f=f i=ɪ sh=ʃ', 'sun-fish', null, 'none'),
  ts('l=l e=ɛ m=m o=ə n=n', 'lem-on', '🍋', 'exact', 'schwa'),
  ts('m=m e=ɛ l=l o=ə n=n', 'mel-on', '🍈', 'exact', 'schwa'),
  ts('p=p a=æ n=n d=d a=ə', 'pan-da', '🐼', 'exact', 'schwa'),
  ts('s=s a=æ l=l a=ə d=d', 'sal-ad', '🥗', 'close', 'green salad; schwa'),
  ts('c=k a=æ m=m e=ə l=l', 'cam-el', '🐪', 'close', 'schwa'),
  ts('p=p u=ʌ m=m p=p k=k i=ɪ n=n', 'pump-kin', '🎃', 'close', 'needs blend (mp)'),
  ts('d=d r=r a=æ g=g o=ə n=n', 'drag-on', '🐉', 'exact', 'needs blend (dr); schwa'),
]

// ---- blend: adjacent consonants. Ready, but not for now. ----
const bl = w('blend')
export const WORDS_BLEND: readonly WordEntry[] = [
  bl('a=æ n=n t=t', 'ant', '🐜', 'exact'),
  bl('h=h a=æ n=n d=d', 'hand', '🖐️', 'close'),
  bl('m=m i=ɪ l=l k=k', 'milk', '🥛', 'close', 'glass of milk'),
  bl('t=t e=ɛ n=n t=t', 'tent', '⛺', 'exact'),
  bl('n=n e=ɛ s=s t=t', 'nest', '🪺', 'close', 'nest with eggs'),
  bl('f=f r=r o=ɑ g=g', 'frog', '🐸', 'exact'),
  bl('f=f l=l a=æ g=g', 'flag', '🚩', 'close', 'triangular flag'),
  bl('c=k l=l o=ɑ ck=k', 'clock', '⏰', 'close', 'alarm clock'),
  bl('t=t r=r u=ʌ ck=k', 'truck', '🚚', 'close', 'delivery truck'),
  bl('b=b r=r i=ɪ ck=k', 'brick', '🧱', 'exact'),
  bl('c=k r=r a=æ b=b', 'crab', '🦀', 'exact'),
  bl('d=d r=r u=ʌ m=m', 'drum', '🥁', 'exact'),
  bl('s=s t=t o=ɑ p=p', 'stop', '🛑', 'close', 'stop sign'),
  bl('s=s w=w i=ɪ m=m', 'swim', '🏊', 'close', 'person swimming'),
  bl('s=s l=l e=ɛ d=d', 'sled', '🛷', 'exact'),
  bl('g=g i=ɪ f=f t=t', 'gift', '🎁', 'exact'),
]

export const WORDS: readonly WordEntry[] = [
  ...WORDS_VC,
  ...WORDS_CVC_CONT,
  ...WORDS_CVC,
  ...WORDS_CVC_X,
  ...WORDS_DIGRAPH,
  ...WORDS_TWOSYL,
  ...WORDS_BLEND,
]

export const WORD_BY_ID: ReadonlyMap<WordId, WordEntry> = new Map(
  WORDS.map((entry) => [entry.id, entry] as const),
)
if (WORD_BY_ID.size !== WORDS.length) throw new Error('Duplicate word id in the dataset')

export function wordInfo(id: WordId): WordEntry {
  const found = WORD_BY_ID.get(id)
  if (!found) throw new Error(`Unknown word: ${id}`)
  return found
}

export function isWordId(value: unknown): value is WordId {
  return typeof value === 'string' && WORD_BY_ID.has(value)
}

export function picturable(words: readonly WordEntry[]): readonly WordEntry[] {
  return words.filter((entry) => entry.picture !== 'none')
}

/**
 * Words deliberately not in the dataset, with the reason. Do not add them
 * back without moving them to a stage that teaches the exception.
 */
export const DROPPED: readonly { readonly word: string; readonly why: string }[] = [
  { word: 'gem', why: 'g says /dʒ/ - soft g is a later stage' },
  { word: 'ball', why: 'a before ll says /ɔ/, not /æ/' },
  { word: 'was', why: 'a is /ʌ/ and s is /z/ - two exceptions in three letters' },
  { word: 'put', why: 'u says /ʊ/, not /ʌ/' },
  { word: 'has', why: 'final s says /z/' },
  { word: 'robot', why: 'open first syllable: o says /oʊ/ - later' },
  { word: 'pencil', why: 'c says /s/ before i - later' },
  { word: 'window', why: 'ow is a vowel team' },
  { word: 'penguin', why: 'gu says /gw/' },
  { word: 'zebra', why: 'open syllable, long e' },
  { word: 'lion', why: 'i says /aɪ/ across a syllable break' },
  { word: 'monkey', why: 'o says /ʌ/, ey is a vowel team' },
  { word: 'yak', why: 'not in the spoken vocabulary of this child' },
]
