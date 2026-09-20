# ABC Quest

An English alphabet trainer for a 4-6 year old. A web app for iPad with no
backend: all progress lives in this browser's `localStorage`.

**Play: https://egorvas.github.io/abc-quest/**

Everything in the app is in English, including the interface. There is barely
any text: a child who cannot read yet navigates by icons.

## Games

Eight of them, across four memory channels.

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

The first screen asks which letters are already known. Without it, a child who
knows twenty letters would spend weeks being taught them again, one per
session, before the app ever reached the six they actually need. Ticked letters
start as easy wins, so the very first round goes straight to the gaps.

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
  or a fixed easy / medium / hard. This drives how many options are on screen,
  the size of the hunt field, the number of pairs to match and the keyboard
  layout.

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

## Rewards

Three horizons rather than confetti on every answer:

1. **The letter's note** on every answer. Pitch follows the position in the
   alphabet, `A` low and `Z` high, on a pentatonic scale so nothing can sound
   wrong.
2. **Seeds** at the end of a round: one burst of confetti and one to three
   seeds.
3. **The garden**, 26 plots. The top stage of a plot cannot be reached by
   tapping: it needs spoken or written evidence.

The garden never wilts, never gets hungry and asks for nothing while the child
is away. The stepping-stone path only grows longer, so a missed day is not an
event.

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
- Several profiles on one iPad: each child has their own garden.
- A whole profile is a few dozen KB, far from Safari's quota.
- **Safari on iOS erases site data after about seven days without opening it.**
  Add the page to the home screen and use "Save a copy" in the grown-ups
  section.

## Development

```bash
npm install
npm run dev          # http://localhost:5173/abc-quest/
npm run build
npm run deploy       # build, then push to the gh-pages branch
npm run simulate     # run the engine against a synthetic child
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
