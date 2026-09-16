# WS4 Mobile & Accessibility — Keyboard walkthrough (FEAT-003)

End-to-end keyboard-only path through every interactive control in each widget, plus the shared
`QualityToggle`, with the visible focus indicator noted and the WS3 canvas-click affordances mapped
to their keyboard/AT-reachable equivalents. Verified against source on branch
`a11y/mobile-accessibility` (build commit for the evidence: rebuilt clean, all five routes
prerendered).

## Conventions

- A keyboard user moves forward with **Tab** and backward with **Shift+Tab**; buttons activate with
  **Enter/Space**, radios move with the arrow keys (native radio behaviour), text inputs accept
  typing, and the colour `<input type="color">` opens the native picker with Enter/Space.
- Every control shows a **visible focus indicator**. Chef/coach/pet controls and `QualityToggle`
  already carried focus rings; WS4 added `focus:outline-none focus-visible:ring-2
  focus-visible:ring-[#2c2a26] focus-visible:ring-offset-1` to the wardrobe option-card buttons,
  colour-swatch buttons, animation-radio buttons, and `focus-within:ring-*` to the custom-colour
  `<label>` (see `components/WardrobeBuilder.tsx`). No existing label/aria was removed.
- `QualityToggle` (the WS2 single quality control) is a two-radio High/Fast group pinned in the
  stage corner of every demo; it is Tab-reachable and its selected radio shows a ring. It remains the
  ONLY quality control — no parallel keyboard path was introduced.

## Chef — `/projects/chef-chatbot`

Tab order (DOM): **QualityToggle (High / Fast radios) → mute toggle → suggestion chips → composer
input → Send**.

1. QualityToggle High/Fast — arrow/Enter to switch renderer quality; focus ring visible.
2. Mute toggle — Enter/Space toggles TTS voice; focus ring visible.
3. Suggestion chips (rendered from the engine's `suggestions`, e.g. "Suggest a recipe", "Find
   recipes with chicken", "Show me something vegan") — Enter/Space sends that text through the SAME
   `send()` the composer uses.
4. Composer text input — type a message; labelled, focus ring visible; aria-live log announces
   replies.
5. Send button — Enter/Space submits.

**WS3 clickable-prop equivalent:** the canvas `onSampleDishClick` calls `send("Suggest a recipe")`.
The **"Suggest a recipe" suggestion chip** calls the identical `send("Suggest a recipe")`, so the
dish-click intent is fully reachable by keyboard through the same handler — no canvas click needed.

## Coach — `/projects/coach-trainer`

Tab order mirrors chef: **QualityToggle (High / Fast) → mute toggle → suggestion chips → composer
input → Send**.

1. QualityToggle High/Fast.
2. Mute toggle.
3. Suggestion chips — Enter/Space routes through the coach engine's `send()`.
4. Composer input — type a workout question; aria-live log announces replies.
5. Send button.

Coach has no WS3 canvas-click prop to mirror (its interaction is the composer/engine path, already
fully keyboard-driven).

## Pet — `/projects/virtual-pet`

Tab order: **QualityToggle (High / Fast) → Feed → Play → Sleep → Clean → name input → Save**.

1. QualityToggle High/Fast.
2. Feed / Play / Sleep / Clean action buttons — Enter/Space each call `doAction(<action>)`, mutating
   the shared `lib/pet` state (the stat bars are `role=progressbar` and announce via aria-live).
3. Name input — type the pet's name.
4. Save button — persists the name/state locally.

**WS3 clickable-prop equivalent:** the canvas `onPetClick` calls `doAction("play")`. The **"Play"
action button** calls the identical `doAction("play")`, so petting-the-dog is fully reachable by
keyboard through the same handler.

## Wardrobe — `/projects/digital-wardrobe`

The builder is a 3-column layout: left menu, centre stage, right menu. Tab order:
**QualityToggle (High / Fast) → left menu (Shoes, Hair): option-card buttons → colour swatches →
custom-colour picker → animation radios → right menu (Top, Bottoms): option-card buttons → colour
swatches → custom-colour picker**.

1. QualityToggle High/Fast.
2. Per category (Shoes, Hair, Top, Bottoms):
   - **Option-card buttons** — Enter/Space calls `setOption(cat, index)` (aria-pressed reflects the
     selection); WS4-added focus-visible ring.
   - **Colour swatch buttons** — Enter/Space calls `setColor(cat, color)`; WS4-added focus-visible
     ring; the swatch rows `flex-wrap` so they never widen the page.
   - **Custom-colour picker** (`<label>` wrapping `<input type="color">`) — Enter/Space opens the
     native OS colour picker; WS4-added `focus-within` ring.
3. **Animation radios** — arrow/Enter select the clip to play (rest/idle/…); WS4-added focus-visible
   ring.

**WS3 clickable-prop equivalent:** clicking a garment on the canvas calls `cycleCategory(cat)`, which
routes through `setOption`. The **per-category option-card buttons** call the SAME `setOption`, so
every garment/category is selectable by keyboard through the same handler — the canvas cycle is a
convenience shortcut, not the only path.

## Summary

Every interactive control across the four demos and the shared `QualityToggle` is reachable by
keyboard in a sensible order with a visible `focus-visible` indicator, and each of the three WS3
canvas-click affordances (chef dish, pet body, wardrobe garment) has a documented keyboard/AT
equivalent that runs through the identical handler — no parallel logic path was added.
