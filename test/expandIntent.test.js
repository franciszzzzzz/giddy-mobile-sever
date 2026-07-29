import { test, describe } from "node:test";
import assert from "node:assert/strict";

import expandIntent from "../ai/rag/query/expandIntent.js";
import { INTENTS } from "../ai/constants/intents.js";

/**
 * Tests for the intent expansion layer.
 *
 * expandIntent() sits between intent detection / memory resolution and
 * product retrieval. It does NOT change the intent type; it only refines
 * the query and builds an explicit search plan.
 *
 * The key behavioral contracts covered here:
 *  - Guard: no intent / no type → passthrough
 *  - FOLLOW_UP → pass-through (query kept as-is, no searches)
 *  - Non-product intents (GREETING, UNKNOWN, ...) → filler-stripped query, no searches
 *  - Product intents → keyword built ONLY from entities mentioned in the
 *    current query (memory-inherited entities are excluded from the keyword)
 *  - searches array includes ALL entities (current + memory) for retrieval
 *  - search ordering: category → brand → productType → keyword → featured
 */

describe("expandIntent — guard clauses", () => {
  test("returns the input untouched when no argument is given", () => {
    assert.deepEqual(expandIntent(), {});
  });

  test("returns the intent untouched when it has no type", () => {
    const intent = { query: "hello", brand: { name: "Olay" } };
    assert.equal(expandIntent(intent), intent);
    // No expansion fields added
    assert.equal(intent.expandedQuery, undefined);
    assert.equal(intent.searches, undefined);
  });

  test("returns null intent untouched", () => {
    assert.equal(expandIntent(null), null);
  });
});

describe("expandIntent — FOLLOW_UP (pass-through)", () => {
  test("keeps the original query verbatim and adds no searches", () => {
    const intent = {
      type: INTENTS.FOLLOW_UP,
      query: "tell me more about it",
    };

    const result = expandIntent(intent);

    assert.equal(result.type, INTENTS.FOLLOW_UP);
    assert.equal(result.expandedQuery, "tell me more about it");
    assert.deepEqual(result.searches, []);
  });

  test("preserves other intent fields", () => {
    const intent = {
      type: INTENTS.FOLLOW_UP,
      query: "yes",
      brand: { id: 1, name: "Olay" },
      productType: "perfume",
    };

    const result = expandIntent(intent);

    assert.deepEqual(result.brand, { id: 1, name: "Olay" });
    assert.equal(result.productType, "perfume");
  });
});

describe("expandIntent — non-product intents", () => {
  test("GREETING strips filler and produces no searches", () => {
    const result = expandIntent({
      type: INTENTS.GREETING,
      query: "hi can you help me please",
    });

    assert.deepEqual(result.searches, []);
    // "hi", "you" survive (not in filler set); "can", "help", "me", "please" removed
    assert.equal(result.expandedQuery, "hi you");
  });

  test("UNKNOWN strips filler and produces no searches", () => {
    const result = expandIntent({
      type: INTENTS.UNKNOWN,
      query: "what is the best perfume",
    });

    assert.deepEqual(result.searches, []);
    // "what", "is", "the", "best" removed; "perfume" kept
    assert.equal(result.expandedQuery, "perfume");
  });

  test("FRAGRANCE_EDUCATION strips filler and produces no searches", () => {
    const result = expandIntent({
      type: INTENTS.FRAGRANCE_EDUCATION,
      query: "tell me about oud notes",
    });

    assert.deepEqual(result.searches, []);
    // "tell", "me", "about" removed; "oud", "notes" kept
    assert.equal(result.expandedQuery, "oud notes");
  });

  test("empty query yields empty expandedQuery", () => {
    const result = expandIntent({
      type: INTENTS.GREETING,
      query: "",
    });

    assert.equal(result.expandedQuery, "");
    assert.deepEqual(result.searches, []);
  });
});

describe("expandIntent — product keyword building", () => {
  test("builds keyword from productType mentioned in the query", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "I need good Genie and storm perfumes",
      productType: "perfume",
    });

    // "perfume" alias is prepended; remaining meaningful words appended,
    // minus the "perfume" token already present and any filler/short words.
    // Stripped words: genie, storm, perfumes  -> perfumes length>2 kept.
    assert.equal(result.expandedQuery, "perfume genie storm perfumes");
  });

  test("builds keyword from brand + productType when both are mentioned", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_INFORMATION,
      query: "Sahib",
      brand: { id: 123, name: "Sahiib", slug: "sahiib" },
    });

    // Brand "Sahiib" is NOT in the query, so it is excluded from keyword
    // and searches. Only the stripped word "sahib" remains.
    assert.equal(result.expandedQuery, "sahib");
  });

  test("prepends brand name when brand IS mentioned in the query", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "show me Olay perfumes",
      brand: { id: 1, name: "Olay" },
      productType: "perfume",
    });

    // Brand "Olay" is mentioned -> prepended first; perfume alias added.
    // "show", "me" are filler and dropped. Note the leftover "perfumes"
    // (plural) survives because dedup is token-exact against "perfume".
    assert.equal(result.expandedQuery, "Olay perfume perfumes");
  });

  test("includes fragrance note when mentioned", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "Floral perfumes for women",
      productType: "perfume",
      note: "floral",
      gender: "women",
    });

    // perfume alias + floral alias + women alias, then remaining "perfumes"
    assert.equal(result.expandedQuery, "perfume floral women perfumes");
  });

  test("includes occasion when mentioned", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_RECOMMENDATION,
      query: "a perfume for my wedding day",
      productType: "perfume",
      occasion: "wedding",
    });

    // perfume + wedding aliases; "day" kept from stripped remainder
    assert.equal(result.expandedQuery, "perfume wedding day");
  });

  test("includes category group when mentioned", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "gift sets for men",
      categoryGroup: { slug: "gift-set" },
      gender: "men",
    });

    // Keyword priority is gender BEFORE categoryGroup, so "men" comes first.
    // "gift set" alias added, then leftover plural "sets" (token-exact dedup
    // leaves it since the alias is the singular "gift set").
    assert.equal(result.expandedQuery, "men gift set sets");
  });

  test("recommendation with no entities keeps only meaningful words", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_RECOMMENDATION,
      query: "Recommend a gift for my dad",
      recipient: "dad",
    });

    // "recommend", "a", "for", "my" are filler; "gift" + "dad" remain
    assert.equal(result.expandedQuery, "gift dad");
  });
});

describe("expandIntent — memory-inherited entity isolation", () => {
  test("a brand present in intent but NOT in the query is excluded from keyword", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "any nice perfumes for women",
      brand: { id: 9, name: "Genie" }, // not mentioned in query
      productType: "perfume",
      gender: "women",
    });

    // "Genie" must not appear; "nice" is filler, "any" is filler.
    assert.ok(!result.expandedQuery.includes("genie"));
    assert.ok(!result.expandedQuery.includes("Genie"));
    assert.equal(result.expandedQuery, "perfume women perfumes");
  });

  test("a brand absent from the query is still excluded even when no other entities", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "show me something nice",
      brand: { name: "Storm" },
    });

    // "storm" must not appear; all query words are filler
    assert.equal(result.expandedQuery, "");
  });

  test("productType in intent but not mentioned in query is excluded from keyword", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "looking for candles",
      productType: "perfume", // not mentioned; "candles" belongs to a different type
    });

    // perfume alias must not be injected; only "candles" remains
    assert.equal(result.expandedQuery, "candles");
  });

  test("note in intent but not mentioned in query is excluded from keyword", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "any perfumes",
      productType: "perfume",
      note: "woody", // not mentioned
    });

    assert.equal(result.expandedQuery, "perfume perfumes");
  });
});

describe("expandIntent — searches array", () => {
  test("includes brand, productType and keyword in order when mentioned", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "Olay perfumes",
      brand: { name: "Olay" },
      productType: "perfume",
    });

    const types = result.searches.map((s) => s.type);
    // Order: brand -> productType -> keyword (no category/featured here)
    assert.deepEqual(types, ["brand", "productType", "keyword"]);

    const brandSearch = result.searches.find((s) => s.type === "brand");
    assert.equal(brandSearch.value, "Olay");

    const productSearch = result.searches.find((s) => s.type === "productType");
    assert.equal(productSearch.value, "perfume");
    assert.equal(productSearch.searchTerm, "perfume");

    const keywordSearch = result.searches.find((s) => s.type === "keyword");
    // "Olay perfume" from entities + leftover plural "perfumes"
    assert.equal(keywordSearch.value, "Olay perfume perfumes");
  });

  test("emits a featured search when intent.featured is true", () => {
    const result = expandIntent({
      type: INTENTS.FEATURED_PRODUCTS,
      query: "perfumes",
      productType: "perfume",
      featured: true,
    });

    const featured = result.searches.filter((s) => s.type === "featured");
    assert.equal(featured.length, 1);
    assert.equal(featured[0].value, true);
  });

  test("includes memory-inherited brand in searches even if not in keyword", () => {
    // Brand is in intent but not in query -> excluded from keyword,
    // but STILL present in the searches array for retrieval strategies.
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "perfumes for women",
      brand: { name: "Genie" }, // not in query
      productType: "perfume",
      gender: "women",
    });

    const brandSearch = result.searches.find((s) => s.type === "brand");
    assert.ok(brandSearch, "memory brand should still appear in searches");
    assert.equal(brandSearch.value, "Genie");

    // ...yet the keyword must not contain it.
    const keywordSearch = result.searches.find((s) => s.type === "keyword");
    assert.ok(!keywordSearch.value.toLowerCase().includes("genie"));
  });

  test("category search comes first when category group is present", () => {
    const result = expandIntent({
      type: INTENTS.CATEGORY,
      query: "gift sets for men",
      categoryGroup: { slug: "gift-set" },
      gender: "men",
    });

    assert.equal(result.searches[0].type, "category");
    assert.equal(result.searches[0].value, "gift-set");
  });

  test("does not emit productType search when alias lookup fails", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "widgets",
      productType: "unknownType", // no aliases in dictionary
    });

    // No productType search, no injection into keyword; just stripped word.
    assert.ok(!result.searches.some((s) => s.type === "productType"));
    assert.equal(result.expandedQuery, "widgets");
  });
});

describe("expandIntent — currency / number stripping", () => {
  test("removes naira amounts and 'under' price phrases", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "perfumes under ₦50,000",
      productType: "perfume",
    });

    // The ₦50,000 token should be stripped; "perfume" alias + "perfumes".
    assert.ok(!result.expandedQuery.includes("50"));
    assert.ok(!result.expandedQuery.includes("₦"));
    assert.equal(result.expandedQuery, "perfume perfumes");
  });

  test("removes 'less than' and 'between ... and ...' price phrases", () => {
    const r1 = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "perfumes less than 20000",
      productType: "perfume",
    });
    assert.ok(!r1.expandedQuery.includes("20000"));

    const r2 = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "perfumes between 10000 and 30000",
      productType: "perfume",
    });
    assert.ok(!r2.expandedQuery.includes("10000"));
    assert.ok(!r2.expandedQuery.includes("30000"));
  });
});

describe("expandIntent — immutability", () => {
  test("returns a new object and does not mutate the input", () => {
    const intent = {
      type: INTENTS.PRODUCT_SEARCH,
      query: "Olay perfumes",
      brand: { name: "Olay" },
      productType: "perfume",
    };

    const snapshot = JSON.stringify(intent);
    const result = expandIntent(intent);

    assert.notEqual(result, intent);
    // Original intent is unchanged
    assert.equal(JSON.stringify(intent), snapshot);
    assert.equal(intent.expandedQuery, undefined);
    assert.equal(intent.searches, undefined);
  });

  test("preserves all original intent fields on the result", () => {
    const intent = {
      type: INTENTS.PRODUCT_SEARCH,
      query: "Olay perfumes",
      brand: { name: "Olay" },
      productType: "perfume",
      confidence: 0.95,
      recipient: "self",
    };

    const result = expandIntent(intent);

    assert.equal(result.type, INTENTS.PRODUCT_SEARCH);
    assert.equal(result.confidence, 0.95);
    assert.equal(result.recipient, "self");
    assert.deepEqual(result.brand, { name: "Olay" });
  });
});
