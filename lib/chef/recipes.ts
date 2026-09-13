// Bundled recipe knowledge base for the chef chatbot.
//
// This data is self-authored for this project (no external dataset), so there
// are no third-party licensing constraints. It is intentionally small and
// dependency-free: the conversational engine (chefEngine.ts) does keyword and
// intent matching against these records entirely in the browser, which keeps
// the static export (output:'export') server-free and offline-friendly.

export type DietaryFlag = "vegetarian" | "vegan" | "gluten-free" | "dairy-free";

export interface Ingredient {
  /** Human-readable quantity, e.g. "200g" or "2 cloves". */
  quantity: string;
  /** Ingredient name, lowercase for easy matching, e.g. "spaghetti". */
  item: string;
}

export interface Recipe {
  /** Stable kebab-case identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Cuisine label, e.g. "Italian". */
  cuisine: string;
  /** Free-form tags used for retrieval (comfort, quick, one-pot, etc.). */
  tags: string[];
  /** Ingredients with quantities. */
  ingredients: Ingredient[];
  /** Ordered step-by-step instructions. */
  steps: string[];
  /** Prep time in minutes. */
  prepMinutes: number;
  /** Cook time in minutes. */
  cookMinutes: number;
  /** Number of servings the recipe yields. */
  servings: number;
  /** Dietary flags that apply to the recipe as written. */
  dietary: DietaryFlag[];
}

export const recipes: Recipe[] = [
  {
    id: "spaghetti-aglio-e-olio",
    name: "Spaghetti Aglio e Olio",
    cuisine: "Italian",
    tags: ["pasta", "quick", "comfort", "budget", "weeknight"],
    ingredients: [
      { quantity: "400g", item: "spaghetti" },
      { quantity: "6 cloves", item: "garlic" },
      { quantity: "120ml", item: "olive oil" },
      { quantity: "1 tsp", item: "red pepper flakes" },
      { quantity: "1 handful", item: "parsley" },
      { quantity: "to taste", item: "salt" },
    ],
    steps: [
      "Bring a large pot of salted water to a boil and cook the spaghetti until al dente.",
      "While it cooks, thinly slice the garlic and warm the olive oil in a wide pan over low heat.",
      "Add the garlic and red pepper flakes, cooking gently until the garlic is golden but not brown.",
      "Reserve a cup of pasta water, then drain and toss the spaghetti into the garlicky oil.",
      "Loosen with a splash of pasta water, fold through chopped parsley, and season to taste.",
    ],
    prepMinutes: 5,
    cookMinutes: 15,
    servings: 4,
    dietary: ["vegetarian", "vegan", "dairy-free"],
  },
  {
    id: "chickpea-coconut-curry",
    name: "Chickpea Coconut Curry",
    cuisine: "Indian",
    tags: ["curry", "one-pot", "comfort", "meal-prep", "spicy"],
    ingredients: [
      { quantity: "2 cans", item: "chickpeas" },
      { quantity: "1 can", item: "coconut milk" },
      { quantity: "1 large", item: "onion" },
      { quantity: "3 cloves", item: "garlic" },
      { quantity: "1 tbsp", item: "curry powder" },
      { quantity: "1 can", item: "chopped tomatoes" },
      { quantity: "2 tbsp", item: "olive oil" },
    ],
    steps: [
      "Dice the onion and garlic, then soften them in olive oil over medium heat.",
      "Stir in the curry powder and cook for a minute until fragrant.",
      "Add the tomatoes and simmer for 5 minutes to concentrate the flavour.",
      "Pour in the coconut milk and drained chickpeas, then simmer for 15 minutes.",
      "Season to taste and serve over rice or with warm flatbread.",
    ],
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 4,
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
  },
  {
    id: "classic-margherita-pizza",
    name: "Classic Margherita Pizza",
    cuisine: "Italian",
    tags: ["pizza", "baking", "weekend", "comfort"],
    ingredients: [
      { quantity: "500g", item: "pizza dough" },
      { quantity: "200ml", item: "tomato sauce" },
      { quantity: "250g", item: "mozzarella" },
      { quantity: "1 handful", item: "basil" },
      { quantity: "2 tbsp", item: "olive oil" },
    ],
    steps: [
      "Heat the oven as hot as it will go, ideally with a stone or steel inside.",
      "Stretch the dough into a thin round on a floured surface.",
      "Spread a thin layer of tomato sauce and scatter torn mozzarella over the top.",
      "Bake until the crust is blistered and the cheese bubbles, about 8 to 10 minutes.",
      "Finish with fresh basil and a drizzle of olive oil before slicing.",
    ],
    prepMinutes: 20,
    cookMinutes: 10,
    servings: 2,
    dietary: ["vegetarian"],
  },
  {
    id: "lemon-herb-roast-chicken",
    name: "Lemon Herb Roast Chicken",
    cuisine: "American",
    tags: ["roast", "dinner", "sunday", "protein"],
    ingredients: [
      { quantity: "1 whole (1.5kg)", item: "chicken" },
      { quantity: "1", item: "lemon" },
      { quantity: "4 sprigs", item: "thyme" },
      { quantity: "3 tbsp", item: "butter" },
      { quantity: "to taste", item: "salt" },
      { quantity: "to taste", item: "black pepper" },
    ],
    steps: [
      "Heat the oven to 200C (400F) and pat the chicken dry.",
      "Rub softened butter all over the skin and season generously with salt and pepper.",
      "Halve the lemon and tuck it into the cavity along with the thyme.",
      "Roast for about 75 minutes, basting once, until the juices run clear.",
      "Rest for 15 minutes before carving so the juices settle.",
    ],
    prepMinutes: 15,
    cookMinutes: 75,
    servings: 4,
    dietary: ["gluten-free"],
  },
  {
    id: "veggie-fried-rice",
    name: "Veggie Fried Rice",
    cuisine: "Chinese",
    tags: ["rice", "quick", "leftovers", "one-pan", "weeknight"],
    ingredients: [
      { quantity: "3 cups", item: "cooked rice" },
      { quantity: "2", item: "eggs" },
      { quantity: "1 cup", item: "mixed vegetables" },
      { quantity: "3 tbsp", item: "soy sauce" },
      { quantity: "2 cloves", item: "garlic" },
      { quantity: "2 tbsp", item: "vegetable oil" },
    ],
    steps: [
      "Heat the oil in a wok or wide pan until shimmering.",
      "Scramble the beaten eggs quickly, then push them to one side.",
      "Add the garlic and vegetables, stir-frying for a couple of minutes.",
      "Tip in the cold cooked rice and toss over high heat to separate the grains.",
      "Splash in the soy sauce, combine everything, and serve hot.",
    ],
    prepMinutes: 10,
    cookMinutes: 10,
    servings: 3,
    dietary: ["vegetarian", "dairy-free"],
  },
  {
    id: "hearty-lentil-soup",
    name: "Hearty Lentil Soup",
    cuisine: "Mediterranean",
    tags: ["soup", "one-pot", "budget", "comfort", "meal-prep"],
    ingredients: [
      { quantity: "300g", item: "dried lentils" },
      { quantity: "2", item: "carrots" },
      { quantity: "2 stalks", item: "celery" },
      { quantity: "1", item: "onion" },
      { quantity: "1.5L", item: "vegetable stock" },
      { quantity: "1 can", item: "chopped tomatoes" },
      { quantity: "2 tbsp", item: "olive oil" },
    ],
    steps: [
      "Finely dice the onion, carrots, and celery, then sweat them in olive oil.",
      "Rinse the lentils and add them to the pot with the tomatoes.",
      "Pour in the stock and bring to a gentle boil.",
      "Simmer for 30 to 35 minutes until the lentils are tender.",
      "Season well and blend a portion if you like a thicker texture.",
    ],
    prepMinutes: 10,
    cookMinutes: 35,
    servings: 6,
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
  },
  {
    id: "banana-oat-pancakes",
    name: "Banana Oat Pancakes",
    cuisine: "American",
    tags: ["breakfast", "quick", "kid-friendly", "sweet"],
    ingredients: [
      { quantity: "2 ripe", item: "bananas" },
      { quantity: "1 cup", item: "rolled oats" },
      { quantity: "2", item: "eggs" },
      { quantity: "1 tsp", item: "baking powder" },
      { quantity: "1 pinch", item: "cinnamon" },
    ],
    steps: [
      "Blend the bananas, oats, eggs, baking powder, and cinnamon into a smooth batter.",
      "Let the batter rest for 5 minutes so the oats soften.",
      "Heat a lightly oiled non-stick pan over medium heat.",
      "Pour small rounds and cook until bubbles form, then flip and cook the other side.",
      "Serve warm with fruit or a drizzle of honey.",
    ],
    prepMinutes: 5,
    cookMinutes: 10,
    servings: 2,
    dietary: ["vegetarian", "gluten-free"],
  },
  {
    id: "greek-salad",
    name: "Greek Salad",
    cuisine: "Greek",
    tags: ["salad", "no-cook", "fresh", "summer", "quick"],
    ingredients: [
      { quantity: "4", item: "tomatoes" },
      { quantity: "1", item: "cucumber" },
      { quantity: "1", item: "red onion" },
      { quantity: "200g", item: "feta" },
      { quantity: "1 handful", item: "olives" },
      { quantity: "3 tbsp", item: "olive oil" },
      { quantity: "1 tsp", item: "oregano" },
    ],
    steps: [
      "Cut the tomatoes and cucumber into chunky pieces and thinly slice the red onion.",
      "Combine the vegetables with the olives in a large bowl.",
      "Break the feta into large pieces and lay it on top.",
      "Drizzle with olive oil, scatter over oregano, and season lightly.",
      "Toss gently at the table so the feta stays in generous pieces.",
    ],
    prepMinutes: 15,
    cookMinutes: 0,
    servings: 4,
    dietary: ["vegetarian", "gluten-free"],
  },
  {
    id: "beef-tacos",
    name: "Weeknight Beef Tacos",
    cuisine: "Mexican",
    tags: ["tacos", "quick", "family", "weeknight"],
    ingredients: [
      { quantity: "500g", item: "ground beef" },
      { quantity: "1", item: "onion" },
      { quantity: "1 tbsp", item: "taco seasoning" },
      { quantity: "8", item: "corn tortillas" },
      { quantity: "1 cup", item: "shredded lettuce" },
      { quantity: "1 cup", item: "grated cheese" },
    ],
    steps: [
      "Brown the ground beef in a hot pan, breaking it up as it cooks.",
      "Add the diced onion and taco seasoning, cooking until the onion softens.",
      "Splash in a little water and simmer until the mixture is saucy.",
      "Warm the tortillas in a dry pan or over a flame.",
      "Fill the tortillas with beef, lettuce, and cheese, then serve straight away.",
    ],
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    dietary: ["gluten-free"],
  },
  {
    id: "tomato-basil-soup",
    name: "Tomato Basil Soup",
    cuisine: "Italian",
    tags: ["soup", "comfort", "budget", "quick"],
    ingredients: [
      { quantity: "2 cans", item: "chopped tomatoes" },
      { quantity: "1", item: "onion" },
      { quantity: "2 cloves", item: "garlic" },
      { quantity: "500ml", item: "vegetable stock" },
      { quantity: "1 handful", item: "basil" },
      { quantity: "2 tbsp", item: "olive oil" },
    ],
    steps: [
      "Soften the diced onion and garlic in olive oil over medium heat.",
      "Add the tomatoes and stock, then bring to a simmer.",
      "Cook gently for 20 minutes to deepen the flavour.",
      "Blend until smooth and stir through torn basil.",
      "Season to taste and serve with crusty bread.",
    ],
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 4,
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
  },
  {
    id: "overnight-oats",
    name: "Berry Overnight Oats",
    cuisine: "American",
    tags: ["breakfast", "no-cook", "make-ahead", "healthy"],
    ingredients: [
      { quantity: "1 cup", item: "rolled oats" },
      { quantity: "1 cup", item: "plant milk" },
      { quantity: "2 tbsp", item: "chia seeds" },
      { quantity: "1 cup", item: "mixed berries" },
      { quantity: "1 tbsp", item: "maple syrup" },
    ],
    steps: [
      "Stir the oats, plant milk, chia seeds, and maple syrup together in a jar.",
      "Fold through half of the berries.",
      "Seal the jar and refrigerate overnight, or at least 4 hours.",
      "In the morning, stir and loosen with a splash more milk if needed.",
      "Top with the remaining berries and enjoy cold.",
    ],
    prepMinutes: 5,
    cookMinutes: 0,
    servings: 2,
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
  },
  {
    id: "mushroom-risotto",
    name: "Mushroom Risotto",
    cuisine: "Italian",
    tags: ["rice", "comfort", "dinner", "vegetarian"],
    ingredients: [
      { quantity: "300g", item: "arborio rice" },
      { quantity: "300g", item: "mushrooms" },
      { quantity: "1", item: "onion" },
      { quantity: "1L", item: "vegetable stock" },
      { quantity: "50g", item: "parmesan" },
      { quantity: "2 tbsp", item: "butter" },
      { quantity: "100ml", item: "white wine" },
    ],
    steps: [
      "Warm the stock in a separate pot and keep it at a gentle simmer.",
      "Saute the sliced mushrooms until golden, then set them aside.",
      "Soften the diced onion in butter, then stir in the rice for a minute.",
      "Pour in the wine, then add the stock a ladle at a time, stirring until absorbed.",
      "After about 18 minutes fold in the mushrooms and parmesan, then serve creamy.",
    ],
    prepMinutes: 10,
    cookMinutes: 30,
    servings: 4,
    dietary: ["vegetarian", "gluten-free"],
  },
];
