import { test, describe } from "node:test";
import assert from "node:assert/strict";

import buildPrompt from "../ai/prompts/promptBuilder.js";
import { INTENTS } from "../ai/constants/intents.js";

/**
 * Tests for the prompt builder's catalogue-grounding rules.
 *
 * Production regression (2026-08-14): a product query that retrieved zero
 * products produced a reply naming a "Stellar perfume" that existed nowhere
 * in the (empty) product context — the model invented it from conversation
 * history, and the product card correctly showed nothing, so text and card
 * disagreed. With zero retrieved products, product intents must now receive
 * an explicit "nothing was retrieved — do not name products" instruction.
 */

// Unique to the injected catalogue block (the base system prompt shares the
// "official Giddy & Claire catalogue" phrasing, so the JSON header is the
// reliable marker).
const CATALOGUE_BLOCK = "Retrieved Products:";
const EMPTY_GUARD_BLOCK = "No products were retrieved";

describe("promptBuilder — with retrieved products", () => {
  test("injects the catalogue block for product intents", () => {
    const messages = buildPrompt({
      userMessage: "show me sahib",
      intent: { type: INTENTS.PRODUCT_INFORMATION },
      context: {
        products: [{ name: "Genie Sahiib Perfume", inStock: true }],
      },
      history: [],
    });

    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");

    assert.ok(system.includes(CATALOGUE_BLOCK));
    assert.ok(!system.includes(EMPTY_GUARD_BLOCK));
    assert.ok(system.includes("Genie Sahiib Perfume"));
  });
});

describe("promptBuilder — zero retrieved products (Stellar regression)", () => {
  for (const type of [
    INTENTS.PRODUCT_SEARCH,
    INTENTS.PRODUCT_RECOMMENDATION,
    INTENTS.PRODUCT_INFORMATION,
    INTENTS.PRODUCT_COMPARISON,
  ]) {
    test(`product intent ${type} gets the no-product guard`, () => {
      const messages = buildPrompt({
        userMessage: "Recommend a gift for my boyfriend",
        intent: { type },
        context: { products: [] },
        history: [],
      });

      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");

      assert.ok(system.includes(EMPTY_GUARD_BLOCK), `${type} must get the guard`);
      assert.ok(!system.includes(CATALOGUE_BLOCK));
    });
  }

  test("guard forbids naming specific products", () => {
    const messages = buildPrompt({
      userMessage: "what do you recommend?",
      intent: { type: INTENTS.PRODUCT_RECOMMENDATION },
      context: { products: [] },
      history: [],
    });

    const guard = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .find((c) => c.includes(EMPTY_GUARD_BLOCK));

    assert.ok(guard.includes("Do NOT name"));
  });

  test("non-product intents do NOT get the guard", () => {
    for (const type of [
      INTENTS.GREETING,
      INTENTS.FRAGRANCE_EDUCATION,
      INTENTS.STORE_INFORMATION,
      INTENTS.UNKNOWN,
      INTENTS.FOLLOW_UP,
    ]) {
      const messages = buildPrompt({
        userMessage: "hello",
        intent: { type },
        context: { products: [] },
        history: [],
      });

      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");

      assert.ok(!system.includes(EMPTY_GUARD_BLOCK), `${type} must not get the guard`);
    }
  });
});
