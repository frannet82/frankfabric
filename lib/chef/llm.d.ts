// Type declarations for the plain-JavaScript offline intelligence layer
// (llm.js). These mirror the JSDoc types in llm.js and give the strict-TS side
// (chefEngine.ts) precise signatures without any `any`.

import type { Recipe, DietaryFlag } from "./recipes";

/** Structured interpretation of a user's free-text message. */
export interface ParsedQuery {
  intent: "suggest" | "find";
  dietary: DietaryFlag[];
  includeIngredients: string[];
  excludeIngredients: string[];
  maxTime: number | null;
  mealType: string | null;
  cuisine: string | null;
  surprise: boolean;
  normalized: string;
}

/** A single ranked recipe option. */
export interface RankedOption {
  recipe: Recipe;
  score: number;
  rationale: string;
}

/** The full result of interpreting a message against a corpus. */
export interface SuggestResult {
  options: RankedOption[];
  chips: string[];
  query: ParsedQuery;
}

export function parseQuery(text: string): ParsedQuery;
export function rankRecipes(query: ParsedQuery, corpus: Recipe[]): RankedOption[];
export function suggestRecipes(
  userText: string,
  corpus: Recipe[],
  limit?: number,
): SuggestResult;
