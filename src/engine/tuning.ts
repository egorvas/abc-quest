/**
 * Every tunable number in the learning engine, in one place.
 *
 * Defaults target a 4-6 year old who plays five to ten minutes at a time, a
 * few times a week, on a parent's schedule rather than their own.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

export const TUNING = {
  /* ---- forgetting ---- */
  /** Half-life, in days, granted by the very first correct answer. */
  seedHalfLifeDays: 0.5,
  /** Floor after a mistake: a lapsed letter is due again almost immediately. */
  minHalfLifeDays: 0.15,
  /** A letter this settled stops blocking the next one from being introduced. */
  settledHalfLifeDays: 2.5,
  /** A cell above this half-life counts as solid. */
  solidHalfLifeDays: 7,
  /** Ceiling. Beyond three weeks the difference stops mattering to a child. */
  maxHalfLifeDays: 120,
  masterHalfLifeDays: 21,

  /**
   * Growth per correct answer, before the surprise discount.
   * The surprise term is what stops "easy wins" from inflating mastery: a
   * correct answer about a letter seen twenty seconds ago teaches nothing.
   */
  gain: 2.4,
  /** Fraction of the half-life kept after a wrong answer. */
  lapse: 0.4,
  /** An answer the game had to reveal is worth a fraction of an unaided one. */
  assistedFactor: 0.35,

  /* ---- retrieval ---- */
  /** Below this recall probability a letter is treated as weak. */
  weakBelow: 0.45,
  /** Above this it is a safe easy win. */
  easyAbove: 0.8,

  /* ---- mastery gates ---- */
  masteryFreshness: 0.8,
  masteryDistinctDays: 2,
  /** Correct answers needed on guessable exercises... */
  masteryCorrectGuessable: 8,
  /** ...and on exercises that cannot be guessed. */
  masteryCorrectProduced: 3,
  /** Guess rate at or below which an exercise counts as "not guessable". */
  producedGuessRate: 0.06,

  /* ---- session ---- */
  sessionLength: 14,
  /**
   * Ceiling on how much of a round asks the child to produce a letter rather
   * than recognise one. Speaking and writing are the valuable channels, but
   * they are also the slow ones, and a parent marking a letter as "known"
   * means recognition, so weakest-first would otherwise hand out nothing else.
   */
  demandingShareCap: 0.35,
  /** At most one brand-new letter per session... */
  maxNewPerSession: 1,
  /** ...and only while this few letters are still unfinished. */
  maxOpenBeforeNew: 5,
  /** Same letter may not reappear within this many items. */
  repeatGap: 3,
  mix: {
    newFrac: 0.15,
    /**
     * Ceiling on how much of a round may be spent on letters the child has
     * never answered. It only binds when there is nothing weak to review -
     * exactly the case of a child who already knows twenty letters and needs
     * six. The other half stays easy wins, so the round is still winnable.
     */
    newShareCap: 0.5,
    weakBase: 0.45,
    weakSlope: -0.2,
    reviewBase: 0.2,
    reviewSlope: 0.3,
    easyMin: 0.15,
  },

  /* ---- confusion ---- */
  /** Learned confusion weights fade by this factor each session. */
  confusionDecay: 0.92,
  /** A confusable partner may appear as a distractor only above this recall. */
  confusionTargetMin: 0.75,
  /** ...and only when the partner itself is this well known. */
  confusionPartnerMin: 0.6,
  confusionMinAttempts: 4,
  confusionMinStreak: 2,
  /** Below this recall the partner is banned from the same screen entirely. */
  confusionBanBelow: 0.4,
  /** ...and kept this many session positions away. */
  confusionSpacing: 4,

  /* ---- frustration guards ---- */
  missesBeforeHint: 1,
  missesBeforeReveal: 2,
  hintAfterIdleMs: 12000,
  revealAfterIdleMs: 25000,

  /* ---- tracing ---- */
  traceCoverage: 0.55,
  tracePrecision: 0.6,

  /* ---- rewards ---- */
  seedsPerSession: { min: 1, max: 3 },
  /** Garden bed stages, by letter progress. */
  sproutAtHalfLifeDays: 1,
  flowerAtHalfLifeDays: 7,

  /* ---- storage ---- */
  historyLimit: 40,
} as const
