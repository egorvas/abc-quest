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
  /** Past this, automatic difficulty starts asking expert-level questions. */
  expertHalfLifeDays: 18,
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
  /**
   * At the expert level the emphasis flips: a child who reads the alphabet
   * learns nothing more from picking a tile out of four, so most of the round
   * asks them to say, type or write the letter instead.
   */
  expertDemandingShareCap: 0.55,
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
  /** The expert level puts the confusable partner on screen as soon as this holds. */
  confusionEagerTargetMin: 0.6,
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

  /* ---- Letter Town: the nut economy ---- */
  town: {
    /** Slot prices. Price order is gate order: the cheapest is always the one
     *  that is always open. The friend costs exactly the gold-star bonus. */
    price: { front: 3, back: 5, friend: 7 },
    extraPrice: 10,
    bonus: {
      /** Per letter that reached mastered during the round. Pays for its friend. */
      star: 7,
      /** First unguessable correct answer on a letter. Pays for a front item. */
      firstWrite: 3,
      /** First round of the day after a gap of this many days or more. */
      welcomeBack: 2,
      welcomeBackAfterDays: 3,
      /** First round of any new calendar day. */
      newDay: 1,
      /** Any round, at this probability. Unscheduled on purpose. */
      surprise: 1,
      surpriseChance: 0.12,
    },
    /** The very first round can always buy something. */
    firstRoundFloor: 3,
    /** Days played that open each town-wide extra. */
    extraAt: { clouds: 2, sky: 5, tram: 9, night: 14, balloons: 20, fireworks: 28 },
    /** Share of a focused round given to the letter the child chose. */
    focusShare: 0.4,
  },

  /* ---- storage ---- */
  historyLimit: 40,
} as const
