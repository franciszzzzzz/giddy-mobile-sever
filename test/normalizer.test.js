import { test, describe } from "node:test";
import assert from "node:assert/strict";

import normalizeIntent from "../ai/agent/intentDetector/normalizer.js";
import resolveIntentWithMemory from "../ai/memory/memoryResolver.js";

/**
 * Pipeline-seam tests for the intent normalizer and memory resolver.
 *
 * Production regression (2026-08-14): normalizeIntent() silently dropped
 * `entities.categoryGroup`, so the category retrieval strategy could never
 * fire — "Recommend a gift for him" detected gender "men" (keyword "men
 * gift") but searchCount stayed at 1 and returned 0 products. The extractor
 * did its job; the normalizer threw the entity away between extraction and
 * expansion.
 */

describe("normalizeIntent — entity passthrough", () => {
  test("forwards categoryGroup (the 2026-08-14 regression)", () => {
    const intent = normalizeIntent(
      "PRODUCT_RECOMMENDATION",
      { categoryGroup: { slug: "men", name: "men" }, gender: "men" },
      "Recommend a gift for him",
    );

    assert.deepEqual(intent.categoryGroup, { slug: "men", name: "men" });
    assert.equal(intent.gender, "men");
  });

  test("forwards featured flag", () => {
    const intent = normalizeIntent(
      "PRODUCT_RECOMMENDATION",
      { featured: true },
      "What's your best seller?",
    );

    assert.equal(intent.featured, true);
  });

  test("defaults absent entities to null/false without crashing", () => {
    const intent = normalizeIntent("PRODUCT_SEARCH", {}, "perfumes");

    assert.equal(intent.categoryGroup, null);
    assert.equal(intent.featured, false);
    assert.equal(intent.brand, undefined); // passthrough, no || null default
    assert.equal(intent.recipient, null);
  });
});

describe("resolveIntentWithMemory — categoryGroup inheritance", () => {
  test("inherits categoryGroup from memory.lastCategory when not detected", () => {
    const resolved = resolveIntentWithMemory(
      { type: "PRODUCT_SEARCH", query: "gift sets" },
      { lastCategory: { slug: "men", name: "men" } },
    );

    assert.deepEqual(resolved.categoryGroup, { slug: "men", name: "men" });
  });

  test("keeps the freshly detected categoryGroup over memory", () => {
    const resolved = resolveIntentWithMemory(
      {
        type: "PRODUCT_SEARCH",
        query: "for her",
        categoryGroup: { slug: "women", name: "women" },
      },
      { lastCategory: { slug: "men", name: "men" } },
    );

    assert.equal(resolved.categoryGroup.slug, "women");
  });

  test("does not invent a categoryGroup when memory has none", () => {
    const resolved = resolveIntentWithMemory(
      { type: "PRODUCT_SEARCH", query: "perfumes" },
      {},
    );

    assert.equal(resolved.categoryGroup, undefined);
  });
});
