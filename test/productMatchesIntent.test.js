import { test, describe } from "node:test";
import assert from "node:assert/strict";

import productMatchesIntent from "../ai/rag/helpers/productMatchesIntent.js";

const perfume = {
  id: 1,
  name: "Amber Oud Eau de Parfum",
  categories: [{ name: "Perfumes" }],
  tags: [{ name: "Lattafa" }],
  short_description: "Warm amber fragrance",
};

describe("productMatchesIntent", () => {
  test("does not reject a valid product because occasion metadata is absent", () => {
    assert.equal(
      productMatchesIntent(perfume, { occasion: "party" }),
      true,
    );
  });

  test("does not reject a valid product because gender metadata is absent", () => {
    assert.equal(
      productMatchesIntent(perfume, { gender: "women" }),
      true,
    );
  });

  test("does not reject a valid product because note metadata is absent", () => {
    assert.equal(
      productMatchesIntent(perfume, { note: "vanilla" }),
      true,
    );
  });

  test("still enforces an explicitly requested brand", () => {
    assert.equal(
      productMatchesIntent(perfume, { brand: { name: "Armaf" } }),
      false,
    );
  });

  test("still excludes a rejected brand", () => {
    assert.equal(
      productMatchesIntent(perfume, { excludeBrand: { name: "Lattafa" } }),
      false,
    );
  });
});
