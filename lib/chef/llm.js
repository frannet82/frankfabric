// @ts-check
// Offline, client-side "LLM-style" intelligence layer for the chef chatbot.
//
// The deployed site is a STATIC EXPORT (next.config.js output:'export') with no
// server and no API keys at runtime, so this module is intentionally 100%
// client-side, offline, deterministic, and dependency-free. It performs no I/O
// and makes no network calls. It provides richer natural-language understanding
// than the plain keyword cascade in chefEngine.ts: it parses a free-text
// message into a structured query, matches ingredients and dish names with
// synonym + fuzzy tolerance across the merged recipe corpus, scores every
// candidate, and returns the top ranked options each with a short rationale
// plus a set of follow-up suggestion chips.
//
// This file is plain JavaScript per the project owner's explicit request. The
// project is strict TypeScript with allowJs enabled and eslint next/typescript
// rules apply here too, so the exported API is typed entirely via JSDoc rather
// than `any`. The `// @ts-check` directive above makes tsc type-check this file
// against its JSDoc, and the strict-TS side (chefEngine.ts) imports the exported
// types directly from these `@typedef`s — there is no separate hand-written
// declaration file to drift out of sync.

/**
 * @typedef {import("./recipes").Recipe} Recipe
 * @typedef {import("./recipes").DietaryFlag} DietaryFlag
 */

/**
 * Structured interpretation of a user's free-text message.
 * @typedef {Object} ParsedQuery
 * @property {"suggest"|"find"} intent - Whether the user wants an open suggestion or a constrained find.
 * @property {DietaryFlag[]} dietary - Dietary flags the recipe must satisfy.
 * @property {string[]} includeIngredients - Ingredients (canonicalised) the user explicitly asked for via a cue ("with X"); a recipe with none is penalised.
 * @property {string[]} softIncludeIngredients - Bare-noun ingredient/dish signals matched against the corpus vocabulary (no cue word); these only bias ranking upward and never penalise.
 * @property {string[]} excludeIngredients - Ingredients (canonicalised) the user wants excluded.
 * @property {number|null} maxTime - Maximum total time in minutes, or null when unconstrained.
 * @property {string|null} mealType - Meal/tag cue such as "breakfast", "dinner", "dessert".
 * @property {string|null} cuisine - Cuisine cue such as "italian", or null.
 * @property {boolean} surprise - True when the user asked to be surprised / for any idea.
 * @property {string} normalized - The normalised source text (lowercase, punctuation stripped).
 */

/**
 * A single ranked recipe option.
 * @typedef {Object} RankedOption
 * @property {Recipe} recipe - The matched recipe.
 * @property {number} score - Relevance score (higher is better).
 * @property {string} rationale - Short human-readable reason this recipe was chosen.
 */

/**
 * The full result of interpreting a message against a corpus.
 * @typedef {Object} SuggestResult
 * @property {RankedOption[]} options - Top ranked options, best first.
 * @property {string[]} chips - Follow-up suggestion chips derived from the results.
 * @property {ParsedQuery} query - The structured query that produced these options.
 */

/**
 * Synonym / regional-variant map. Keys and values are canonical lowercase
 * ingredient words; every alias resolves to the first listed canonical term so
 * that "aubergine" and "eggplant" match the same recipes.
 * @type {Record<string, string>}
 */
const SYNONYMS = {
  aubergine: "eggplant",
  eggplant: "eggplant",
  courgette: "zucchini",
  zucchini: "zucchini",
  coriander: "cilantro",
  cilantro: "cilantro",
  chickpea: "chickpea",
  chickpeas: "chickpea",
  garbanzo: "chickpea",
  garbanzos: "chickpea",
  prawn: "shrimp",
  prawns: "shrimp",
  shrimp: "shrimp",
  scallion: "spring onion",
  scallions: "spring onion",
  capsicum: "pepper",
  aubergines: "eggplant",
  rocket: "arugula",
  arugula: "arugula",
  maize: "corn",
  corn: "corn",
  minced: "ground",
  mince: "ground",
  beef: "beef",
  chook: "chicken",
  chicken: "chicken",
  aioli: "garlic",
};

/** Dietary cue words mapped to the canonical DietaryFlag. */
const DIET_CUES = /** @type {Array<{flag: DietaryFlag, patterns: RegExp[]}>} */ ([
  { flag: "vegan", patterns: [/\bvegan\b/, /\bplant based\b/, /\bplant-based\b/] },
  {
    flag: "vegetarian",
    patterns: [/\bvegetarian\b/, /\bveggie\b/, /\bmeatless\b/, /\bno meat\b/],
  },
  {
    flag: "gluten-free",
    patterns: [/\bgluten free\b/, /\bgluten-free\b/, /\bglutenfree\b/, /\bceliac\b/, /\bcoeliac\b/],
  },
  {
    flag: "dairy-free",
    patterns: [/\bdairy free\b/, /\bdairy-free\b/, /\bdairyfree\b/, /\blactose\b/, /\bno dairy\b/],
  },
]);

/** Meal-time cues mapped to tag/keyword hints found on recipes. */
const MEAL_CUES = /** @type {Array<{meal: string, patterns: RegExp[]}>} */ ([
  { meal: "breakfast", patterns: [/\bbreakfast\b/, /\bbrunch\b/, /\bmorning\b/] },
  { meal: "lunch", patterns: [/\blunch\b/, /\bmidday\b/] },
  { meal: "dinner", patterns: [/\bdinner\b/, /\bsupper\b/, /\bevening meal\b/] },
  { meal: "dessert", patterns: [/\bdessert\b/, /\bsweet\b/, /\bpudding\b/, /\btreat\b/] },
  { meal: "snack", patterns: [/\bsnack\b/, /\bnibble\b/, /\bbite\b/] },
  { meal: "starter", patterns: [/\bstarter\b/, /\bappetizer\b/, /\bappetiser\b/, /\bstart\b/] },
]);

/** Known cuisine words the parser recognises. */
const CUISINES = [
  "american",
  "british",
  "chinese",
  "french",
  "fusion",
  "hawaiian",
  "indian",
  "italian",
  "japanese",
  "korean",
  "malaysian",
  "mediterranean",
  "mexican",
  "middle eastern",
  "moroccan",
  "spanish",
  "thai",
  "vietnamese",
  "greek",
];

/**
 * Words that are never treated as ingredient constraints even when they appear
 * after "with"/"no". Keeps the extractor from grabbing filler words.
 * @type {Set<string>}
 */
const NON_INGREDIENT_WORDS = new Set([
  "a",
  "an",
  "the",
  "some",
  "any",
  "something",
  "anything",
  "dish",
  "meal",
  "recipe",
  "recipes",
  "food",
  "dinner",
  "lunch",
  "breakfast",
  "dessert",
  "snack",
  "brunch",
  "supper",
  "quick",
  "fast",
  "easy",
  "simple",
  "healthy",
  "light",
  "hearty",
  "vegan",
  "vegetarian",
  "veggie",
  "gluten",
  "dairy",
  "free",
  "meatless",
  "and",
  "or",
  "but",
  "please",
  "idea",
  "ideas",
  "option",
  "options",
  "made",
  "make",
  "cook",
  "using",
  "use",
  "want",
  "like",
  "need",
  "for",
  "me",
  "my",
  "tonight",
  "today",
  "that",
  "this",
  "very",
  "really",
  "super",
]);

/** Common filler tokens removed before tokenising ingredient phrases. */
const TIME_WORDS = /\b(quick|fast|speedy|easy|simple|weeknight|in a hurry|no time)\b/;

/**
 * Normalise text: lowercase, strip punctuation, collapse whitespace.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reduce a word to a rough singular form so "tomatoes" matches "tomato".
 * @param {string} word
 * @returns {string}
 */
function singularize(word) {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Resolve a word to its canonical synonym form (after singularising).
 * @param {string} word
 * @returns {string}
 */
function canonical(word) {
  const singular = singularize(word);
  if (SYNONYMS[word]) return SYNONYMS[word];
  if (SYNONYMS[singular]) return SYNONYMS[singular];
  return singular;
}

/**
 * Levenshtein edit distance between two short strings (used for fuzzy matches).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  /** @type {number[]} */
  let prev = new Array(n + 1);
  /** @type {number[]} */
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * Fuzzy equality: exact, substring, or small edit distance for longer words.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function fuzzyEqual(a, b) {
  if (a === b) return true;
  // Substring tolerance: only when one word fully contains the other and the
  // shorter word is a substantial token (>=5 chars), e.g. "mushroom" in
  // "mushrooms" or "chick pea" spacing artefacts. This avoids matching
  // unrelated words that merely share a stem.
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 5 && longer.includes(shorter)) return true;
  // Edit-distance tolerance for typos: allow a single edit, and only for words
  // of length >=5 so short, distinct food words (e.g. "chicken" vs "chickpea")
  // are not conflated.
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 5) return false;
  return editDistance(a, b) <= 1;
}

/**
 * Does the recipe contain an ingredient matching the canonical needle?
 * @param {Recipe} recipe
 * @param {string} needle - Already canonicalised ingredient word.
 * @param {boolean} [exact=false] - When true, require an exact canonical match
 *   (no edit-distance/substring fuzzing). Used for bare-noun soft includes,
 *   which are already corpus-vocabulary words and must not conflate near
 *   spellings such as "pasta" and "paste".
 * @returns {boolean}
 */
function recipeHasIngredient(recipe, needle, exact = false) {
  return recipe.ingredients.some((ingredient) => {
    const words = normalize(ingredient.item).split(" ");
    return words.some((word) =>
      exact ? canonical(word) === needle : fuzzyEqual(canonical(word), needle),
    );
  });
}

/**
 * Extract ingredient words that follow inclusion cues (with / using / has).
 * @param {string} normalized
 * @returns {string[]}
 */
function extractIncludes(normalized) {
  /** @type {Set<string>} */
  const found = new Set();
  const regex = /\b(?:with|using|use|contains?|containing|got|have)\s+([a-z0-9\s-]+)/g;
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    collectIngredientWords(match[1], found);
  }
  return Array.from(found);
}

/**
 * Extract ingredient words that follow exclusion cues (without / no / hold the).
 * @param {string} normalized
 * @returns {string[]}
 */
function extractExcludes(normalized) {
  /** @type {Set<string>} */
  const found = new Set();
  const regex = /\b(?:without|no|hold the|skip the|free of|free from|minus)\s+([a-z0-9\s-]+)/g;
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    collectIngredientWords(match[1], found);
  }
  return Array.from(found);
}

/**
 * Pull plausible ingredient words out of a phrase fragment, stopping at the
 * next connector word, and add their canonical forms to the target set.
 * @param {string} fragment
 * @param {Set<string>} target
 * @returns {void}
 */
function collectIngredientWords(fragment, target) {
  const words = fragment.split(" ").filter(Boolean);
  for (const word of words) {
    if (word === "and" || word === "or" || word === "but" || word === "with") {
      // Allow chaining across "and"/"or"; stop at a hard boundary word.
      continue;
    }
    if (NON_INGREDIENT_WORDS.has(word) || word.length < 3) continue;
    target.add(canonical(word));
  }
}

/**
 * Build the set of canonical "food words" that actually appear in the corpus:
 * every word of every ingredient item plus every word of every recipe name,
 * canonicalised. This is the vocabulary a bare-noun query is matched against so
 * we only pick up tokens the corpus can genuinely satisfy (e.g. "chickpea",
 * "pasta") and never random filler.
 * @param {Recipe[]} corpus
 * @returns {Set<string>}
 */
function buildVocabulary(corpus) {
  /** @type {Set<string>} */
  const vocab = new Set();
  for (const recipe of corpus) {
    for (const ingredient of recipe.ingredients) {
      for (const word of normalize(ingredient.item).split(" ")) {
        if (word.length >= 3 && !NON_INGREDIENT_WORDS.has(word)) vocab.add(canonical(word));
      }
    }
    for (const word of normalize(recipe.name).split(" ")) {
      if (word.length >= 3 && !NON_INGREDIENT_WORDS.has(word)) vocab.add(canonical(word));
    }
  }
  return vocab;
}

/**
 * Extract bare-noun ingredient/dish signals: salient tokens that match the
 * corpus vocabulary even without a preceding cue word ("chickpea curry",
 * "I want pasta"). Conservative by construction — a token is only captured when
 * its canonical form is present in `vocab`, so it can never grab a word the
 * corpus does not actually contain. Tokens already captured as includes or
 * excludes, cuisine names, and known filler are skipped.
 * @param {string} normalized
 * @param {Set<string>} vocab
 * @param {string[]} already - canonical words already captured (include/exclude).
 * @returns {string[]}
 */
function extractBareNouns(normalized, vocab, already) {
  /** @type {Set<string>} */
  const found = new Set();
  const cuisineWords = new Set(CUISINES.join(" ").split(" "));
  for (const raw of normalized.split(" ")) {
    if (raw.length < 3 || NON_INGREDIENT_WORDS.has(raw) || cuisineWords.has(raw)) continue;
    const word = canonical(raw);
    if (already.includes(word) || found.has(word)) continue;
    if (vocab.has(word)) found.add(word);
  }
  return Array.from(found);
}

/**
 * Parse a free-text message into a structured query.
 *
 * When `vocab` (the corpus food vocabulary from {@link buildVocabulary}) is
 * supplied, salient bare nouns that match it are captured as soft include
 * signals even without a cue word, so "chickpea curry" biases toward chickpea
 * dishes. Called without `vocab`, the parser behaves exactly as before.
 * @param {string} text
 * @param {Set<string>} [vocab]
 * @returns {ParsedQuery}
 */
function parseQuery(text, vocab) {
  const normalized = normalize(text);

  /** @type {DietaryFlag[]} */
  const dietary = [];
  for (const cue of DIET_CUES) {
    if (cue.patterns.some((pattern) => pattern.test(normalized)) && !dietary.includes(cue.flag)) {
      dietary.push(cue.flag);
    }
  }

  /** @type {string|null} */
  let mealType = null;
  for (const cue of MEAL_CUES) {
    if (cue.patterns.some((pattern) => pattern.test(normalized))) {
      mealType = cue.meal;
      break;
    }
  }

  /** @type {string|null} */
  let cuisine = null;
  for (const name of CUISINES) {
    if (normalized.includes(name)) {
      cuisine = name;
      break;
    }
  }

  const excludeIngredients = extractExcludes(normalized);
  const includeIngredients = extractIncludes(normalized).filter(
    (word) => !excludeIngredients.includes(word),
  );

  /** @type {string[]} */
  let softIncludeIngredients = [];
  if (vocab) {
    const already = [...includeIngredients, ...excludeIngredients];
    softIncludeIngredients = extractBareNouns(normalized, vocab, already);
  }

  let maxTime = /** @type {number|null} */ (null);
  const explicitTime = normalized.match(/\b(?:under|in|within|less than|max)\s+(\d{1,3})\s*(?:min|mins|minutes)\b/);
  if (explicitTime) {
    maxTime = parseInt(explicitTime[1], 10);
  } else if (TIME_WORDS.test(normalized)) {
    maxTime = 30;
  }

  const surprise = /\b(surprise|anything|whatever|random|dealer's choice|dealers choice|you pick|you choose)\b/.test(
    normalized,
  );

  const hasConstraint =
    dietary.length > 0 ||
    includeIngredients.length > 0 ||
    softIncludeIngredients.length > 0 ||
    excludeIngredients.length > 0 ||
    maxTime !== null ||
    mealType !== null ||
    cuisine !== null;

  /** @type {"suggest"|"find"} */
  const intent = surprise || !hasConstraint ? "suggest" : "find";

  return {
    intent,
    dietary,
    includeIngredients,
    softIncludeIngredients,
    excludeIngredients,
    maxTime,
    mealType,
    cuisine,
    surprise,
    normalized,
  };
}

/**
 * Deterministic hash of a string for stable tie-breaking / pseudo-random picks.
 * @param {string} text
 * @returns {number}
 */
function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Does a recipe satisfy a meal-type cue via its tags?
 * @param {Recipe} recipe
 * @param {string} meal
 * @returns {boolean}
 */
function matchesMeal(recipe, meal) {
  const haystack = recipe.tags.map((tag) => tag.toLowerCase());
  if (haystack.includes(meal)) return true;
  if (meal === "dinner") return haystack.some((tag) => tag === "dinner" || tag === "weeknight" || tag === "comfort");
  if (meal === "lunch") return haystack.some((tag) => tag === "lunch" || tag === "salad" || tag === "wrap" || tag === "bowl");
  if (meal === "dessert") return haystack.some((tag) => tag === "dessert" || tag === "sweet");
  if (meal === "starter") return haystack.some((tag) => tag === "starter" || tag === "snack");
  return false;
}

/**
 * Score a single recipe against a parsed query. Returns the numeric score and
 * a list of positive reasons that fed into it.
 * @param {Recipe} recipe
 * @param {ParsedQuery} query
 * @returns {{score: number, reasons: string[], blocked: boolean}}
 */
function scoreRecipe(recipe, query) {
  let score = 0;
  /** @type {string[]} */
  const reasons = [];
  let blocked = false;

  // Excluded ingredients are a hard filter.
  for (const needle of query.excludeIngredients) {
    if (recipeHasIngredient(recipe, needle)) {
      blocked = true;
    }
  }

  // Dietary requirements: strongly reward satisfied flags, block if missing.
  for (const flag of query.dietary) {
    if (recipe.dietary.includes(flag)) {
      score += 6;
      reasons.push(flag);
    } else {
      blocked = true;
    }
  }

  // Included ingredients: reward each match.
  let ingredientHits = 0;
  for (const needle of query.includeIngredients) {
    if (recipeHasIngredient(recipe, needle)) {
      score += 8;
      ingredientHits += 1;
      reasons.push(`uses ${needle}`);
    }
  }
  // If the user asked for specific ingredients and none are present, deprioritise.
  if (query.includeIngredients.length > 0 && ingredientHits === 0) {
    score -= 5;
  }

  // Soft includes (bare nouns matched against the corpus vocabulary): a match
  // (in the ingredients OR the dish name) biases the recipe upward, but a miss
  // is never penalised, so "chickpea curry" surfaces chickpea dishes without
  // suppressing everything else the way a hard include does.
  const recipeName = normalize(recipe.name);
  for (const needle of query.softIncludeIngredients) {
    if (recipeHasIngredient(recipe, needle, true)) {
      score += 7;
      reasons.push(`uses ${needle}`);
    } else if (recipeName.split(" ").some((word) => canonical(word) === needle)) {
      score += 6;
      reasons.push(needle);
    }
  }

  // Time fit.
  const total = recipe.prepMinutes + recipe.cookMinutes;
  if (query.maxTime !== null) {
    if (total <= query.maxTime) {
      score += 5;
      reasons.push(`ready in ${total} min`);
    } else {
      score -= Math.min(6, Math.ceil((total - query.maxTime) / 10));
    }
  }

  // Meal type via tags.
  if (query.mealType && matchesMeal(recipe, query.mealType)) {
    score += 4;
    reasons.push(query.mealType);
  } else if (query.mealType) {
    score -= 2;
  }

  // Cuisine.
  if (query.cuisine && recipe.cuisine.toLowerCase() === query.cuisine) {
    score += 4;
    reasons.push(`${recipe.cuisine} cuisine`);
  }

  // Small nudge for "quick" tag when time-constrained.
  if (query.maxTime !== null && recipe.tags.includes("quick")) {
    score += 1;
  }

  return { score, reasons, blocked };
}

/**
 * Build a short rationale sentence from the collected reasons.
 * @param {string[]} reasons
 * @returns {string}
 */
function buildRationale(reasons) {
  if (reasons.length === 0) return "a solid all-round pick";
  const unique = Array.from(new Set(reasons));
  return unique.slice(0, 3).join(", ");
}

/**
 * Rank all recipes in the corpus against a structured query.
 * @param {ParsedQuery} query
 * @param {Recipe[]} corpus
 * @returns {RankedOption[]}
 */
function rankRecipes(query, corpus) {
  /** @type {RankedOption[]} */
  const scored = [];
  for (const recipe of corpus) {
    const { score, reasons, blocked } = scoreRecipe(recipe, query);
    if (blocked) continue;
    // For a plain suggestion with no constraints, everything is eligible.
    if (query.intent === "find" && score <= 0) continue;
    scored.push({ recipe, score, rationale: buildRationale(reasons) });
  }

  const seed = hashString(query.normalized);
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deterministic tie-break: stable pseudo-random by id + seed.
    const ha = (hashString(a.recipe.id) ^ seed) >>> 0;
    const hb = (hashString(b.recipe.id) ^ seed) >>> 0;
    if (ha !== hb) return ha - hb;
    return a.recipe.id < b.recipe.id ? -1 : 1;
  });

  return scored;
}

/**
 * Generate follow-up suggestion chips derived from the ranked options and query.
 * @param {RankedOption[]} options
 * @param {ParsedQuery} query
 * @returns {string[]}
 */
function buildChips(options, query) {
  /** @type {string[]} */
  const chips = [];
  const top = options[0];
  if (top) {
    chips.push(`Show ingredients for ${top.recipe.name}`);
    chips.push(`How do I make ${top.recipe.name}?`);
  }
  const second = options[1];
  if (second) {
    chips.push(`Tell me about ${second.recipe.name}`);
  }
  // Offer a constraint-relaxing or exploratory chip.
  if (query.dietary.length > 0) {
    chips.push("Suggest something else");
  } else if (query.includeIngredients.length > 0) {
    chips.push(`More ideas with ${query.includeIngredients[0]}`);
  } else if (query.softIncludeIngredients.length > 0) {
    chips.push(`More ideas with ${query.softIncludeIngredients[0]}`);
  } else {
    chips.push("Surprise me");
  }
  // De-duplicate while preserving order, cap at 4.
  return Array.from(new Set(chips)).slice(0, 4);
}

/**
 * Convenience entry point: parse a message, rank the corpus, and return the top
 * options with rationales plus follow-up chips.
 * @param {string} userText
 * @param {Recipe[]} corpus
 * @param {number} [limit=4]
 * @returns {SuggestResult}
 */
function suggestRecipes(userText, corpus, limit = 4) {
  const query = parseQuery(userText, buildVocabulary(corpus));
  const ranked = rankRecipes(query, corpus);
  const capped = Math.max(1, Math.min(limit, 5));
  const options = ranked.slice(0, capped);
  const chips = buildChips(options, query);
  return { options, chips, query };
}

// `singularize` and `normalize` are exported so chefEngine.ts shares the exact
// same word normalisation used for ingredient matching here, keeping the two
// matching paths consistent (no divergent singular rules).
export { parseQuery, rankRecipes, suggestRecipes, singularize, normalize };
