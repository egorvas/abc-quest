# ABC Quest

A learn-to-read trainer in English for a 4-6 year old: letters, sounds,
blending, short words, digraphs, syllables. A web app for iPad with no
backend: all progress lives in this browser's `localStorage`.

**Play: https://egorvas.github.io/abc-quest/**

Everything in the app is in English, including the interface. There is barely
any text: a child who cannot read yet navigates by icons.

## Levels

A hundred and fifty short numbered levels, each one round of six to eight
questions, each harder than the last. Level 1 is two letters and two easy
games; level 150 is expert reading. Passing a level is the only thing that
opens the next, and what is behind a door is not written on it: the games
change from level to level and the child finds out by opening it. Seven tiers
give the climb its shape, and most of it is reading:

| Levels | Tier | What it asks |
|---|---|---|
| 1–20 | Letters | meet the alphabet, one or two letters at a time, recognise then type and trace |
| 21–32 | Sounds | the sound every letter makes |
| 33–56 | Blending | slide sounds into `s-u-n`, fill the missing letter, pick the picture |
| 57–90 | Words | read and build short words, harder options each level |
| 91–110 | Two letters, one sound | `sh`, `ch`, `ck`, `ng` |
| 111–130 | Syllables | two-part words joined by parts: `rab-bit` |
| 131–150 | Master reader | everything mixed, expert difficulty |

A level is passed with at least half the answers right first time; below
that it says "Almost!" and asks to be tried again. Stars (1 to 3 at 50 / 70 /
90%) are never taken away, and replaying can only raise them. A first pass
pays 2 coins plus 1 per star; a replay pays 1 per new star, or 1. Passing all
hundred and fifty builds the whole city at once.

The recipe of a level is derived from its number with a seeded generator, so
it is the same on every device and every replay. A parent can skip ahead from
the grown-ups screen; skipped levels count as passed with one star and pay
nothing.

**Practice** is the playground next to the levels: any single game, or a
mixed round chosen by the memory model. It pays no coins.

## Games

Thirteen of them, across four memory channels, plus the reading games described
further down. Levels draw from these; practice offers them one at a time.

| Game | What the child does | Skill |
|---|---|---|
| Listen and find | hears a letter, taps it | recognition |
| Which letter? | sees a letter, picks its name among speakers | recognition |
| Say the letter | says it out loud, the app listens | production |
| Type the letter | finds it on a 26-key keyboard | recall |
| Letter hunt | finds every copy in a field of mixed typefaces | recognition |
| Big and small | matches `A` with `a` | recall |
| Trace the letter | writes it with a finger | production |
| A is for Apple | links the letter to its sound and a word | sound |

## Starting from where the child actually is

The grown-ups screen asks which letters are already known. Ticked letters start
as easy wins in practice rounds, so a mixed round goes straight to the gaps;
on the levels, skipping ahead is the equivalent.

A parent's estimate is not proof, so the head start stops short of solid: a
ticked letter still has to hold up in the game before it can earn a star.

Three settings in the grown-ups section shape the rest:

- **How many letters at once** — one by one for a beginner, or a fixed set of
  8, 16 or all 26. With a fixed set every letter is active and the engine picks
  the weakest ones out of the pool.
- **Upper and lower case** — both (the default), or one of them alone. In the
  mixed mode `A` and `a` are two separate memory cells and the weaker one gets
  asked, so lowercase is genuinely tested rather than crowded out.
- **Difficulty** — automatic, where each letter gets the level it has earned,
  or a fixed easy / medium / hard / expert. This drives how many options are on
  screen, the size of the hunt field, the number of pairs to match and the
  keyboard layout. A fixed level applies to every letter; only a letter the
  child has never met, or is currently losing, steps down one level for that
  question.

### Expert

The fourth level is for a child who already reads the alphabet and would learn
nothing more from picking one tile out of four:

- twelve tiles at a time instead of three, and thirty-six in the hunt;
- capitals and lowercase mixed on the same screen, so the board cannot be
  narrowed down by shape;
- the letter the child confuses with the target is always among the options,
  and rhyming names are crowded together on purpose;
- the QWERTY keyboard, and tracing with no outline to follow;
- most of the round spent saying, typing or writing letters rather than tapping
  them.

Two capitals and lowercase are never shown together when they render as the
same shape. Capital I and lowercase l are one vertical bar in this typeface, so
a board with both on it would have no findable answer.

On automatic difficulty this tier arrives by itself: a letter reaches it once
its half-life passes about three weeks, which in the simulation is roughly half
of every round by week six.

## From letters to reading

A child who names every letter can still be unable to read "cat": c, a, t
stay three sounds and never become a word. Five more games carry the child
from letters into blending, gated on the sounds rather than the names.

| Game | What the child does | What it trains |
|---|---|---|
| The missing letter | hears "cat", sees `c_t` and the picture, taps the letter | grapheme to sound, in context |
| What does it say? | reads a word in silence, picks its picture | actual reading, the criterion task |
| Slide it together | pushes two parts of a word into one on a rail | blending |
| Build the word | hears a word, taps its letters in order | segmenting, and at the top level dictation |
| The twins | six quick trials on one confusable pair, b against d | discrimination |

Three things make this a reading track rather than a spelling one:

- **Sounds, not names.** The old sound respellings ("buh", "kuh", "tuh") were
  the mistake: a stop consonant cannot be voiced alone without a parasitic
  vowel, and "buh-a-tuh" never becomes "bat". A stop is now only ever spoken
  attached to the vowel that follows it, and the first blending words start
  with sounds that can be held, m, s, f, n, l, r, so "mmmaaan" runs into
  "man" with no gap. Two picture-game exemplars that taught the wrong sound
  are gone: G is for Goat, not Giraffe, and I is for Insect, not Ice cream.
- **The blend is one utterance.** In "Slide it together" the two pills move
  for half a second while a single continuous utterance runs the sounds into
  each other, and at contact the facing corners lose their radius so two pills
  become one. Silence in the middle would be the very error being corrected.
- **A wrong letter is read back as written.** Tap o into `c_t` and the app
  says "cot", then the letter drops out. Nothing turns red. Hearing that it
  does not say the word is the lesson.

The dataset holds 153 words with grapheme-to-sound splits, syllables and an
emoji each: two-sound words, 40 continuant-onset words, 31 with stop onsets,
digraphs, two-syllable words, and consonant blends held for later. Every word
is checked at load, and words dropped for being irregular at their stage are
listed with the reason so nobody adds them back.

A word appears only when every one of its sounds is known, and the words shown
first are the ones that practise the child's weakest letters. Progress is
measured on words never seen before: every word cell going solid proves
nothing, because a child can memorise 94 word pictures, so the reading stage
only advances on first-try accuracy over novel words.

## How the memory model works

Ordinary spaced repetition (SM-2, Leitner) does not survive contact with a
five-year-old: it counts calendar days and expects a self-assessment of how
well you remember. A child plays when a parent hands over the iPad, and cannot
rate themselves.

Instead every memory cell carries a **half-life**, and the chance of recalling
it decays continuously:

```
p = 2^(-Δt / h)
```

A correct answer stretches the half-life, discounted by surprise:

```
h' = h · (1 + GAIN · weight · (1 − γ) · (1 − p))
```

- `γ` is the chance of being right by luck (0.25 in a one-in-four choice),
- `weight` is the channel: recognition ×1.0, recall ×1.6, production ×2.2,
- `(1 − p)` is the surprise.

So being right about a letter shown twenty seconds ago is worth almost nothing.
The easy wins that keep a child playing cannot inflate mastery.

A cell is not a letter but a triple of **(letter, skill, case)** — eight cells
per letter. A child can tap `B` confidently and be unable to name it; the
engine sees that and picks the exercise that treats the weak channel.

### The gold star

A letter is mastered only when five gates hold at once: every core channel has
a solid trace, enough answers were unguessable, the letter was known on two
different days, it still holds right now, and it survived sitting next to the
letter it gets confused with. Tapping through three-option screens can never
finish a letter.

The star is never taken back. It only dulls and asks to be polished.

### Confusions and traps

- `b/d`, `p/q`, `M/W`, `C/G` and a dozen more pairs are built in, and the
  profile learns its own from real mistakes.
- A confusable letter is used as a distractor **only** once the target is known
  well. While the target is shaky its partner is removed from the screen
  entirely: contrast before an independent trace exists produces interference,
  not discrimination.
- English letter names rhyme in clusters (`B C D E G P T V Z`, `F L M N S X`,
  `A H J K`). Two letters from one cluster are never introduced together, and a
  mistake within a cluster counts as "almost".
- `B C H P X Y` look like Cyrillic letters this child already reads
  differently, so they come late in the order.

Introduction order: `S O D I M R T U L A G N E W F K Z Y X B J C Q V H P`.

## Rewards: the city

Coins build a city on a map. Forty-four things are for sale - houses, an ice
cream stand, roads and street lights, a school, a hospital, a fire station,
the town hall, a zoo, a ferris wheel, a rollercoaster, a stadium, a train
station, a tram, a TV tower, a castle, a rocket, a bridge across the river
and, beyond it, a lighthouse, a harbour, a beach and an airport. Each stands
on the map as a sign with its price until it is bought; things further up the
climb are locked until enough levels are passed, and everything across the
river needs the bridge first. Prices add up to a little less than the coins
the levels pay.

The city is alive. Cars, a bus, a fire engine and a police car drive the
roads that exist; the tram runs once bought; the train runs when there is a
station; boats sail the river once there is a harbour; the plane takes off
from the airport; the ferris wheel turns, the fountain splashes, the zoo
animals peek, the lighthouse beam sweeps, balloons rise, chimneys smoke,
clouds drift and birds cross the sky. At night (real time, or the toggle)
the windows glow, the street lights come on, the stars come out and the
fireworks fire on their own. Tapping anything owned bounces it and says its
name; tapping the rocket launches it.

Nothing in the city can ever be lost, sold or moved. The purse goes down when
the child buys, but a second counter of coins ever earned only climbs.

## Being gentle

One policy across every game: the first mistake is a quiet sound, no red and no
words. The second mistake, and the app shows the answer itself and turns the
question into "say it with me", which cannot be failed. Twelve seconds of
nothing brings a hint, twenty-five brings help. There are no timers, no
penalties and no comparison with anyone.

## The grown-ups screen

Behind a small arithmetic gate: weakest letters, a breakdown by skill, time
spent and share of first-time-right answers, the settings above, and export and
import of a profile as a file.

Every number shown is derived from records the engine already keeps. Nothing
extra is stored to produce the dashboard.

## Data

- Keys `abcq:store` and `abcq:store:bak`, the second copy in case a write is
  interrupted.
- Several profiles on one iPad: each child has their own city.
- A whole profile is a few dozen KB, far from Safari's quota.
- **Safari on iOS erases site data after about seven days without opening it.**
  Add the page to the home screen and use "Save a copy" in the grown-ups
  section.

## Voice

Every line the app says is a prerecorded clip: 801 MP3s, 3.8 MB, generated
by `npm run voice` with Kokoro-82M (Apache-2.0) and committed under
`public/voice`. Letter names are written as explicit IPA so `Z` is never "C"
and `L` is never "oh"; isolated consonants are cut before the vowel the model
wants to add, so `/b/` stays a `/b/` and blending can be heard. Clips play
through Web Audio on the same context as the sound effects, never through an
`<audio>` element (which breaks the next speech recognition on iOS), and
anything without a clip falls back to the device's speech synthesis.

## Development

```bash
npm install
npm run dev          # http://localhost:5173/abc-quest/
npm run build
npm run deploy       # build, then push to the gh-pages branch
npm run simulate     # run the engine against a synthetic child
npx tsx scripts/dev/levels-check.ts # play all 60 levels once and print each round
```

`simulate` plays the app with no browser and prints the learning curve. It
takes days, rounds per day, accuracy, how many letters are known at the start
and the letter pool:

```bash
npm run simulate -- 21 2 0.85 0 auto    # from nothing
npm run simulate -- 21 2 0.85 20 26     # knows 20, all 26 in play
```

Starting from nothing at two short rounds a day: six letters by day three, the
first gold star around day ten, the whole alphabet in about six weeks. Starting
from twenty known letters with all 26 in play: twenty mastered in three weeks,
with 43% of the very first round aimed at the six unknown letters.

Deployment is a script rather than a GitHub Actions workflow because the local
token has no `workflow` scope.

## On the iPad

Add the page to the home screen: it opens full screen with no address bar and
the data survives longer. The microphone game needs HTTPS and permission; when
recognition is unavailable the game turns itself into "repeat after me".
