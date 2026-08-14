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

  test("excludes a brand that is NOT mentioned (even loosely) in the query", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_INFORMATION,
      query: "Sahib",
      brand: { id: 123, name: "Genie", slug: "genie" },
    });

    // Brand "Genie" is unrelated to the query "Sahib" (no literal or fuzzy
    // match), so it is excluded from the keyword. Only the stripped word
    // "sahib" remains.
    assert.equal(result.expandedQuery, "sahib");
  });

  test("keeps a fuzzy-matched brand whose stored name differs from the query", () => {
    // Regression for the production logs: query "Sahib" with detected brand
    // "Sahiib" must keep the brand so the dedicated brand retrieval can run.
    // A literal-substring check would drop it and leave only an ineffective
    // keyword search that returns 0 products.
    const result = expandIntent({
      type: INTENTS.PRODUCT_INFORMATION,
      query: "Sahib",
      brand: { id: 123, name: "Sahiib", slug: "sahiib" },
    });

    // The brand IS mentioned (fuzzy match), so it drives a brand search...
    assert.ok(
      result.searches.some((s) => s.type === "brand"),
      "fuzzy-detected brand must drive a brand search",
    );
    assert.equal(result.brand.name, "Sahiib");

    // ...and is prepended to the keyword.
    assert.equal(result.expandedQuery, "Sahiib sahib");
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

  test("excludes memory-inherited brand from searches when not in the query", () => {
    // Regression: a memory-inherited brand that the user did NOT mention
    // must NOT trigger a productsByBrand retrieval. It should be dropped
    // from both the keyword and the searches array (and the returned
    // intent.brand), so retrieval only reflects the current message.
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "perfumes for women",
      brand: { name: "Genie" }, // not in query
      productType: "perfume",
      gender: "women",
    });

    // No brand search at all.
    assert.ok(!result.searches.some((s) => s.type === "brand"));

    // The returned intent.brand is neutralized for retrieval.
    assert.ok(!result.brand, "retrieval intent.brand must be unset");

    // ...and the keyword must not contain it either.
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

describe("expandIntent — fuzzy & multi-word brand mentions", () => {
  // These cover the production failure where every brand query returned
  // products: 0. A fuzzy-detected brand whose stored name differs from the
  // typed text (e.g. "Sahib" -> "Sahiib") must survive the mention check so
  // the dedicated brand retrieval fires.
  test("keeps a typo'd brand mentioned inside a phrase", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "show me sahib perfumes",
      brand: { id: 123, name: "Sahiib", slug: "sahiib" },
    });

    assert.ok(result.searches.some((s) => s.type === "brand"));
    assert.equal(result.brand.name, "Sahiib");
    assert.ok(result.expandedQuery.toLowerCase().includes("sahib"));
  });

  test("keeps a multi-word brand mentioned in the query", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "do you have oudh al mubaarak",
      brand: { id: 99, name: "Oudh Al Mubaarak", slug: "oudh-al-mubaarak" },
    });

    assert.ok(result.searches.some((s) => s.type === "brand"));
    assert.equal(result.brand.name, "Oudh Al Mubaarak");
  });

  test("drops a brand whose name does not fuzzy-match the query", () => {
    // "sahib" is not close enough to "lattafa", so the brand must be dropped.
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "sahib",
      brand: { id: 5, name: "Lattafa", slug: "lattafa" },
    });

    assert.ok(!result.searches.some((s) => s.type === "brand"));
    assert.ok(!result.brand);
  });
});

describe("expandIntent — regression: memory entities must not pollute retrieval", () => {
  // These mirror real production logs where a brand/productType inherited
  // from conversation memory fired unrelated retrieval searches.
  //
  // Log scenario 1: query "New arrivals" (PRODUCT_SEARCH) with memory
  // brand "Storm" + productType "perfume" produced searches for
  // productsByBrand:"Storm" and search:"perfume" instead of just the
  // user's actual request.
  test('"New arrivals" does not fire memory brand/productType searches', () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "New arrivals",
      brand: { name: "Storm" }, // memory-inherited, not in query
      productType: "perfume", // memory-inherited, not in query
    });

    // expandedQuery must reflect ONLY the current query.
    assert.equal(result.expandedQuery, "new arrivals");

    // No memory-inherited brand/productType searches.
    assert.ok(!result.searches.some((s) => s.type === "brand"));
    assert.ok(!result.searches.some((s) => s.type === "productType"));

    // Retrieval-driving entities neutralized on the returned object.
    assert.ok(!result.brand);
    assert.ok(!result.productType);

    // The keyword search reflects the current query.
    const keyword = result.searches.find((s) => s.type === "keyword");
    assert.equal(keyword.value, "new arrivals");
  });

  // Log scenario 2: a memory-inherited brand that is UNRELATED to the current
  // query must be dropped. Uses an unrelated brand ("Genie") because a
  // typo-close memory brand (e.g. "Sahiib") now legitimately fuzzy-matches a
  // "Sahib" query and is therefore kept — see the positive fuzzy-brand tests.
  test('"Sahib" lookup drops an unrelated memory brand "Genie"', () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_INFORMATION,
      query: "Sahib",
      brand: { id: 123, name: "Genie", slug: "genie" }, // memory-inherited, unrelated
      productType: "perfume", // memory-inherited
    });

    // No memory-inherited brand/productType retrieval.
    assert.ok(!result.searches.some((s) => s.type === "brand"));
    assert.ok(!result.searches.some((s) => s.type === "productType"));
    assert.ok(!result.brand);
    assert.ok(!result.productType);

    // The keyword search targets what the user actually typed.
    assert.equal(result.expandedQuery, "sahib");
    const keyword = result.searches.find((s) => s.type === "keyword");
    assert.equal(keyword.value, "sahib");
  });

  test("memory-inherited productType is neutralized when not in query", () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "looking for candles",
      productType: "perfume", // memory-inherited, not mentioned
    });

    assert.ok(!result.searches.some((s) => s.type === "productType"));
    assert.ok(!result.productType);
    assert.equal(result.expandedQuery, "candles");
  });

  test("memory-inherited categoryGroup is neutralized when not in query", () => {
    const result = expandIntent({
      type: INTENTS.CATEGORY,
      query: "show me everything",
      categoryGroup: { slug: "gift-set" }, // memory-inherited, not mentioned
    });

    assert.ok(!result.searches.some((s) => s.type === "category"));
    assert.ok(!result.categoryGroup);
  });

  test("entities ARE kept when genuinely mentioned in the current query", () => {
    // Positive control: when the user does mention the brand + productType,
    // both retrieval searches must fire. This guards against over-aggressive
    // stripping that would break legitimate product searches.
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "Olay perfumes",
      brand: { name: "Olay" },
      productType: "perfume",
    });

    assert.ok(result.searches.some((s) => s.type === "brand"));
    assert.ok(result.searches.some((s) => s.type === "productType"));
    assert.equal(result.brand.name, "Olay");
    assert.equal(result.productType, "perfume");
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

describe("expandIntent — 2026-08-14 production regressions", () => {
  // These mirror the exact queries that produced garbage keyword searches
  // ("women recommendations her", "options", "Stellar your seller") and
  // returned products: 0 in production.
  test("strips junk filler: options / seller / yeah / products", () => {
    assert.equal(
      expandIntent({
        type: INTENTS.PRODUCT_SEARCH,
        query: "Show more options",
      }).expandedQuery,
      "",
    );

    const bestSeller = expandIntent({
      type: INTENTS.PRODUCT_RECOMMENDATION,
      query: "What's your best seller?",
      featured: true,
    });

    // "what"/"your"/"best"/"seller" are all filler; only the featured
    // retrieval should fire.
    assert.equal(bestSeller.expandedQuery, "");
    assert.ok(
      bestSeller.searches.some((s) => s.type === "featured"),
      "best-seller query must fire the featured retrieval",
    );
    assert.ok(
      !bestSeller.searches.some((s) => s.type === "keyword"),
      "no junk keyword search for best-seller query",
    );
  });

  test('"other products" does not inherit gender "women" via the "her" substring', () => {
    // Regression: the raw substring check saw "her" inside "otHER" and
    // injected the gender term, producing the keyword "women products".
    const result = expandIntent({
      type: INTENTS.PRODUCT_SEARCH,
      query: "other products",
      gender: "women",
    });

    assert.ok(!result.expandedQuery.toLowerCase().includes("women"));
    assert.ok(!result.expandedQuery.toLowerCase().includes("her"));
  });

  test('"Recommend a gift for her" fires the women category retrieval', () => {
    // "her" is now a women category-group alias, so gift-for-her queries
    // retrieve the Women category instead of a dead-end keyword search.
    const result = expandIntent({
      type: INTENTS.PRODUCT_RECOMMENDATION,
      query: "Recommend a gift for her",
      categoryGroup: { slug: "women", name: "women" },
      gender: "women",
    });

    const categorySearch = result.searches.find((s) => s.type === "category");
    assert.ok(categorySearch, "category search must fire");
    assert.equal(categorySearch.value, "women");
  });

  test('"Recommend a gift for my boyfriend" fires the men category retrieval', () => {
    // Production 2026-08-14: this query detected recipient "boyfriend" but
    // nothing mapped it to a retrieval path — only a dead-end keyword search
    // for "gift boyfriend" fired and returned 0 products. Recipient words are
    // now men/women category aliases.
    const result = expandIntent({
      type: INTENTS.PRODUCT_RECOMMENDATION,
      query: "Recommend a gift for my boyfriend",
      categoryGroup: { slug: "men", name: "men" },
      recipient: "boyfriend",
    });

    const categorySearch = result.searches.find((s) => s.type === "category");
    assert.ok(categorySearch, "category search must fire");
    assert.equal(categorySearch.value, "men");
  });

  test('"Yeah peefumes body sprays" keeps the productType search but no brand', () => {
    const result = expandIntent({
      type: INTENTS.PRODUCT_INFORMATION,
      query: "Yeah peefumes body sprays",
      productType: "bodySpray",
    });

    assert.ok(
      result.searches.some(
        (s) => s.type === "productType" && s.value === "bodySpray",
      ),
    );
    assert.ok(!result.searches.some((s) => s.type === "brand"));
    // Filler ("yeah") is stripped from the keyword.
    assert.ok(!result.expandedQuery.toLowerCase().includes("yeah"));
  });
});
