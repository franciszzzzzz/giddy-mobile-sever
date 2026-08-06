import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { detectBrands } from "../ai/agent/intentDetector/brandDetector.js";

/**
 * Tests for brand detection.
 *
 * detectBrands() is the first step in entity extraction: it scans the user's
 * message for brand mentions and its return value becomes `intent.brand`,
 * which drives a dedicated productsByBrand retrieval and gates the final
 * productMatchesIntent filter.
 *
 * A false positive here is catastrophic for retrieval — it pollutes the
 * keyword search, fires an empty brand lookup, and then the semantic filter
 * rejects every product whose text doesn't contain the bogus brand name. That
 * is exactly the production regression these tests guard against: every
 * recommendation query returned `products: 0` because "men", "okay", "for",
 * "i", "man" etc. fuzzy-matched real brand names.
 *
 * The fixture brand list below mirrors the shape returned by the
 * WooCommerce-backed brand dictionary ({ id, name, slug }) and includes the
 * gender-facet tags ("Men", "Women") that real catalogs carry.
 */

const BRANDS = [
  { id: 1, name: "Men", slug: "men" },
  { id: 2, name: "Women", slug: "women" },
  { id: 3, name: "Sahiib", slug: "sahiib" },
  { id: 4, name: "Araman", slug: "araman" },
  { id: 5, name: "Lattafa", slug: "lattafa" },
  { id: 6, name: "Armaf", slug: "armaf" },
  { id: 7, name: "Afnan", slug: "afnan" },
  { id: 8, name: "Oudh Al Mubaarak", slug: "oudh-al-mubaarak" },
  { id: 9, name: "Olay", slug: "olay" },
  { id: 10, name: "Storm", slug: "storm" },
  { id: 11, name: "Genie", slug: "genie" },
  { id: 12, name: "Ard", slug: "ard" },
  { id: 13, name: "Dor", slug: "dor" },
];

describe("detectBrands — gender words must never be brands", () => {
  // These are the exact production queries that returned `products: 0`.
  test('"men perfumes" does not detect "Men" as a brand', () => {
    const { brand } = detectBrands("Okay recomend me good men perfumes", BRANDS);
    assert.equal(brand, null);
  });

  test('"body mists for men" does not detect "Men" as a brand', () => {
    const { brand } = detectBrands("Okay body mists for men", BRANDS);
    assert.equal(brand, null);
  });

  test('"men body sprays" does not detect "Men" as a brand', () => {
    const { brand } = detectBrands("Show me men body sprays or perfume", BRANDS);
    assert.equal(brand, null);
  });

  test('"a man can wear" does not detect "Araman" as a brand', () => {
    const { brand } = detectBrands(
      "Something good that a man can wear that would make me stand out",
      BRANDS,
    );
    assert.equal(brand, null);
  });

  test('"perfume for women" does not detect "Women" as a brand', () => {
    const { brand } = detectBrands("perfume for women", BRANDS);
    assert.equal(brand, null);
  });
});

describe("detectBrands — conversational filler must never be brands", () => {
  test('"okay" does not drift to "Olay"', () => {
    const { brand } = detectBrands("okay", BRANDS);
    assert.equal(brand, null);
  });

  test('"for" does not drift to "Storm"', () => {
    const { brand } = detectBrands("for", BRANDS);
    assert.equal(brand, null);
  });

  test('"i want" does not drift to any brand via the "i" token', () => {
    const { brand } = detectBrands("i want", BRANDS);
    assert.equal(brand, null);
  });

  test("bare pronoun/short words never match", () => {
    for (const word of ["i", "me", "my", "a", "an", "the", "can", "do"]) {
      assert.equal(detectBrands(word, BRANDS).brand, null);
    }
  });
});

describe("detectBrands — the full production regression queries", () => {
  // Every one of these returned `products: 0` in production because a spurious
  // brand hijacked retrieval. They must now detect NO brand.
  const REGRESSION_QUERIES = [
    "I want to attend a wedding what fragrance should I wear",
    "Something good that a man can wear that would make me stand out",
    "Okay recomend me good men perfumes",
    "Show me men body sprays or perfume",
    "Okay body mists for men",
  ];

  for (const query of REGRESSION_QUERIES) {
    test(`detects no brand for: "${query}"`, () => {
      const { brand } = detectBrands(query, BRANDS);
      assert.equal(brand, null);
    });
  }
});

describe("detectBrands — legitimate brands still detected", () => {
  // Positive control: the fix must not over-fire and strip real brand
  // mentions. Typos, multi-word names, and short names must all survive.
  test("detects an exact brand mention inside a phrase", () => {
    const { brand } = detectBrands("show me Olay perfumes", BRANDS);
    assert.equal(brand?.name, "Olay");
  });

  test("detects a typo'd brand via fuzzy match (Sahib -> Sahiib)", () => {
    const { brand } = detectBrands("show me sahib perfumes", BRANDS);
    assert.equal(brand?.name, "Sahiib");
  });

  test("detects a bare typo'd brand", () => {
    const { brand } = detectBrands("sahib", BRANDS);
    assert.equal(brand?.name, "Sahiib");
  });

  test("detects a fuzzy misspelling (latafa -> Lattafa)", () => {
    const { brand } = detectBrands("do you have latafa", BRANDS);
    assert.equal(brand?.name, "Lattafa");
  });

  test("detects a multi-word brand", () => {
    const { brand } = detectBrands("oudh al mubaarak", BRANDS);
    assert.equal(brand?.name, "Oudh Al Mubaarak");
  });

  test("detects a multi-word brand inside a phrase", () => {
    const { brand } = detectBrands("do you have oudh al mubaarak", BRANDS);
    assert.equal(brand?.name, "Oudh Al Mubaarak");
  });

  test("detects a short brand name (Ard)", () => {
    const { brand } = detectBrands("looking for ard", BRANDS);
    assert.equal(brand?.name, "Ard");
  });

  test("detects another short brand name (Dor)", () => {
    const { brand } = detectBrands("any dor products", BRANDS);
    assert.equal(brand?.name, "Dor");
  });
});

describe("detectBrands — comparison products", () => {
  test("returns the top two distinct brands when two are mentioned", () => {
    const { brand, comparisonProducts } = detectBrands(
      "compare lattafa and armaf",
      BRANDS,
    );
    assert.equal(brand?.name, "Lattafa");
    assert.equal(comparisonProducts.length, 2);
  });
});

describe("detectBrands — edge cases", () => {
  test("returns no brand for an empty brand list", () => {
    const { brand, comparisonProducts } = detectBrands("lattafa", []);
    assert.equal(brand, null);
    assert.deepEqual(comparisonProducts, []);
  });

  test("returns no brand for a message with no brand-like tokens", () => {
    const { brand } = detectBrands("hello what can you do", BRANDS);
    assert.equal(brand, null);
  });
});
