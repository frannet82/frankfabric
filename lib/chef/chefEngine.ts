// Deterministic, dependency-free conversational recipe engine.
//
// This is the "brain" of the chef chatbot. It is pure TypeScript with NO React
// and NO three.js imports, so it stays build-safe (the site is a static export
// with output:'export' and no server) and is trivially reusable by the UI in
// FEAT-003. It performs lightweight keyword/intent matching against the bundled
// recipe knowledge base in recipes.ts and answers in a warm chef persona.
//
// An optional in-browser LLM enhancement is intentionally NOT wired here: the
// rule-based engine below is the required, always-available default. A future
// enhancement may dynamically import a browser LLM on explicit user action and
// degrade to this engine, but this module must remain fully functional alone.

import { allRecipes as recipes, type Recipe, type DietaryFlag } from "./recipes";

export type { Recipe, Ingredient, DietaryFlag } from "./recipes";

/** Who authored a chat message. */
export type ChatRole = "user" | "assistant";

/** A single turn in the conversation. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** The engine's reply plus optional quick-reply suggestion chips. */
export interface ChefResponse {
  reply: string;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "Suggest a recipe",
  "Find recipes with chicken",
  "Show me something vegan",
  "How do I make lentil soup?",
];

const DIETARY_LABELS: Record<DietaryFlag, string> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  "gluten-free": "gluten-free",
  "dairy-free": "dairy-free",
};

// A handful of common words we ignore when matching dish/ingredient names so
// that phrases like "how do I make the soup" still find "soup".
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "some",
  "any",
  "me",
  "please",
  "recipe",
  "recipes",
  "dish",
  "for",
  "with",
  "to",
  "how",
  "do",
  "i",
  "you",
  "make",
  "cook",
  "cooking",
  "prepare",
  "show",
  "give",
  "find",
  "of",
  "and",
  "can",
  "could",
  "would",
  "what",
  "whats",
  "is",
  "are",
  "got",
  "have",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

// Very small singular helper so "tomatoes" matches "tomato", etc.
function singularize(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function wordVariants(word: string): string[] {
  const singular = singularize(word);
  return singular === word ? [word] : [word, singular];
}

function formatTime(recipe: Recipe): string {
  const total = recipe.prepMinutes + recipe.cookMinutes;
  return `${total} min total (${recipe.prepMinutes} prep + ${recipe.cookMinutes} cook)`;
}

function dietaryPhrase(recipe: Recipe): string {
  if (recipe.dietary.length === 0) return "";
  const labels = recipe.dietary.map((flag) => DIETARY_LABELS[flag]);
  return ` It is ${labels.join(", ")}.`;
}

function findRecipeByName(text: string): Recipe | undefined {
  const normalized = normalize(text);
  // Prefer the longest name match so "tomato basil soup" beats "tomato soup".
  const matches = recipes
    .filter((recipe) => normalized.includes(normalize(recipe.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (matches.length > 0) return matches[0];

  // Fall back to token overlap against recipe name words.
  const tokens = tokenize(text).flatMap(wordVariants);
  let best: { recipe: Recipe; score: number } | undefined;
  for (const recipe of recipes) {
    const nameWords = new Set(tokenize(recipe.name).flatMap(wordVariants));
    const score = tokens.filter((token) => nameWords.has(token)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { recipe, score };
    }
  }
  return best?.recipe;
}

function recipeMatchesIngredient(recipe: Recipe, needle: string): boolean {
  const variants = wordVariants(needle);
  return recipe.ingredients.some((ingredient) => {
    const itemWords = normalize(ingredient.item).split(" ").flatMap(wordVariants);
    return variants.some((variant) => itemWords.includes(variant));
  });
}

function listNames(list: Recipe[]): string {
  return list.map((recipe) => recipe.name).join(", ");
}

function describeRecipe(recipe: Recipe): string {
  return (
    `${recipe.name} is a ${recipe.cuisine} dish that serves ${recipe.servings}. ` +
    `It takes about ${formatTime(recipe)}.${dietaryPhrase(recipe)} ` +
    `Ask me for the ingredients or how to make it whenever you are ready.`
  );
}

function ingredientsReply(recipe: Recipe): string {
  const lines = recipe.ingredients
    .map((ingredient) => `- ${ingredient.quantity} ${ingredient.item}`)
    .join("\n");
  return `Here is what you need for ${recipe.name} (serves ${recipe.servings}):\n${lines}`;
}

function stepsReply(recipe: Recipe): string {
  const lines = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return (
    `Let's make ${recipe.name}! ${formatTime(recipe)}.\n${lines}\n` +
    `Enjoy, and give it a taste before serving.`
  );
}

function pickSuggestion(seedText: string, list: Recipe[]): Recipe {
  // Deterministic pseudo-random pick: hash the input so repeated identical
  // inputs return the same recipe, but different inputs vary the suggestion.
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
}

const GREETING_WORDS = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "howdy",
  "greetings",
  "hiya",
  "sup",
]);

const DIET_KEYWORDS: Array<{ flag: DietaryFlag; words: string[] }> = [
  { flag: "vegan", words: ["vegan"] },
  { flag: "vegetarian", words: ["vegetarian", "veggie", "meatless"] },
  { flag: "gluten-free", words: ["gluten", "glutenfree", "celiac", "coeliac"] },
  { flag: "dairy-free", words: ["dairy", "dairyfree", "lactose"] },
];

function detectDiet(normalized: string): DietaryFlag | undefined {
  for (const entry of DIET_KEYWORDS) {
    if (entry.words.some((word) => normalized.includes(word))) return entry.flag;
  }
  return undefined;
}

/**
 * Deterministic recipe-chat responder.
 *
 * Given the prior conversation `history` and the new `userText`, returns a warm
 * chef-persona reply plus optional quick-reply suggestions. The same inputs
 * always produce the same output (no randomness, no I/O, no network).
 */
export function respondToMessage(
  history: ChatMessage[],
  userText: string,
): ChefResponse {
  const raw = (userText ?? "").trim();
  const normalized = normalize(raw);

  // Empty input.
  if (normalized.length === 0) {
    return {
      reply:
        "I'm all ears, chef. Tell me what you're in the mood for, or ask me to suggest a recipe.",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const tokens = tokenize(raw);

  // Greeting (only when it's clearly a greeting, not buried in a request).
  const isGreeting =
    tokens.length > 0 &&
    tokens.every((token) => GREETING_WORDS.has(token) || token === "chef");
  if (isGreeting) {
    const isFirstTurn = history.every((message) => message.role !== "assistant");
    const opener = isFirstTurn
      ? "Hello there! I'm your kitchen companion."
      : "Hey again!";
    return {
      reply: `${opener} I can suggest recipes, list ingredients, or walk you through cooking a dish. What sounds good today?`,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // Thanks / friendly sign-off.
  if (/\b(thanks|thank you|cheers|appreciate)\b/.test(normalized)) {
    return {
      reply: "My pleasure, chef! Happy cooking, and come back hungry.",
      suggestions: ["Suggest another recipe", "Find recipes with rice"],
    };
  }

  // Help / capability question.
  if (/\b(help|what can you do|how does this work)\b/.test(normalized)) {
    return {
      reply:
        "I can suggest a recipe, find dishes that use an ingredient you have, list the ingredients for a dish, walk you through the steps, or filter by a diet like vegan or gluten-free. Just ask!",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const diet = detectDiet(normalized);
  const wantsIngredientList = /\bingredient/.test(normalized) || /\bwhat.*(need|in it)\b/.test(normalized);
  const wantsSteps =
    /\bhow (do|to|can)\b/.test(normalized) ||
    /\b(steps|instructions|method|directions)\b/.test(normalized) ||
    /\bmake\b/.test(normalized) ||
    /\bcook\b/.test(normalized);
  const wantsFind = /\b(find|with|using|use|have|got|contain)\b/.test(normalized);
  const wantsSuggest = /\b(suggest|recommend|idea|what should|anything|surprise)\b/.test(normalized);

  const namedRecipe = findRecipeByName(raw);

  // "Show ingredients for <dish>".
  if (wantsIngredientList && namedRecipe) {
    return {
      reply: ingredientsReply(namedRecipe),
      suggestions: [`How do I make ${namedRecipe.name}?`, "Suggest something else"],
    };
  }

  // "How do I make <dish>".
  if (wantsSteps && namedRecipe) {
    return {
      reply: stepsReply(namedRecipe),
      suggestions: [`Show ingredients for ${namedRecipe.name}`, "Suggest another recipe"],
    };
  }

  // Diet filter, e.g. "show me something vegan".
  if (diet) {
    const matches = recipes.filter((recipe) => recipe.dietary.includes(diet));
    if (matches.length > 0) {
      const pick = pickSuggestion(normalized, matches);
      return {
        reply:
          `Here are some ${DIETARY_LABELS[diet]} options: ${listNames(matches)}. ` +
          `How about ${pick.name}? ${describeRecipe(pick)}`,
        suggestions: [
          `Show ingredients for ${pick.name}`,
          `How do I make ${pick.name}?`,
        ],
      };
    }
    return {
      reply: `I don't have a ${DIETARY_LABELS[diet]} recipe on hand right now, but I can suggest something else tasty. Want a suggestion?`,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // "Find recipes with <ingredient>" (also covers "I have <ingredient>").
  if ((wantsFind || tokens.length > 0) && !wantsSuggest) {
    const ingredientTokens = tokens.filter((token) => token.length > 2);
    const matchesByIngredient = recipes.filter((recipe) =>
      ingredientTokens.some((token) => recipeMatchesIngredient(recipe, token)),
    );
    if (matchesByIngredient.length > 0) {
      const found = ingredientTokens.find((token) =>
        matchesByIngredient.some((recipe) => recipeMatchesIngredient(recipe, token)),
      );
      const pick = pickSuggestion(normalized, matchesByIngredient);
      return {
        reply:
          `Nice, ${found} is a great start. You could make: ${listNames(matchesByIngredient)}. ` +
          `I'd go with ${pick.name}. ${describeRecipe(pick)}`,
        suggestions: [
          `Show ingredients for ${pick.name}`,
          `How do I make ${pick.name}?`,
        ],
      };
    }

    // Named a dish without an explicit verb, e.g. "margherita pizza".
    if (namedRecipe) {
      return {
        reply: describeRecipe(namedRecipe),
        suggestions: [
          `Show ingredients for ${namedRecipe.name}`,
          `How do I make ${namedRecipe.name}?`,
        ],
      };
    }
  }

  // General suggestion request.
  if (wantsSuggest || namedRecipe === undefined) {
    const pick = pickSuggestion(normalized, recipes);
    if (wantsSuggest) {
      return {
        reply: `How about ${pick.name}? ${describeRecipe(pick)}`,
        suggestions: [
          `Show ingredients for ${pick.name}`,
          `How do I make ${pick.name}?`,
          "Suggest something else",
        ],
      };
    }
  }

  // Named a dish that we recognised in some other phrasing.
  if (namedRecipe) {
    return {
      reply: describeRecipe(namedRecipe),
      suggestions: [
        `Show ingredients for ${namedRecipe.name}`,
        `How do I make ${namedRecipe.name}?`,
      ],
    };
  }

  // Graceful fallback.
  return {
    reply:
      "I'm not sure I caught that, but I'd love to help you cook. You can ask me to suggest a recipe, find dishes with an ingredient you have, or show you how to make a specific dish.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
