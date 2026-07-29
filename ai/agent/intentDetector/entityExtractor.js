import Fuse from "fuse.js";

import brandDictionary from "../dynamic/brands.js";
import categoryGroups from "../dictionaries/categoryGroups.js";
import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";
import productTypes from "../dictionaries/productTypes.js";

const RECIPIENTS = {
  dad: ["dad", "father", "daddy", "papa"],

  mum: ["mum", "mom", "mother", "mummy"],

  husband: ["husband"],

  wife: ["wife"],

  boyfriend: ["boyfriend"],

  girlfriend: ["girlfriend"],

  brother: ["brother"],

  sister: ["sister"],

  friend: ["friend"],
};

function contains(words, text) {
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

function detectBudget(text) {
  const match =
    text.match(/under\s*₦?\s*([\d,]+)/i) ||
    text.match(/below\s*₦?\s*([\d,]+)/i) ||
    text.match(/less than\s*₦?\s*([\d,]+)/i);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(/,/g, ""));
}

function detectPriceRange(text) {
  const range = text.match(/between\s*₦?\s*([\d,]+)\s*and\s*₦?\s*([\d,]+)/i);

  if (!range) {
    return {
      minPrice: null,
      maxPrice: null,
    };
  }

  return {
    minPrice: Number(range[1].replace(/,/g, "")),
    maxPrice: Number(range[2].replace(/,/g, "")),
  };
}

export default async function extractEntities(message) {
  const text = message.toLowerCase();

  const entities = {
    brand: null,

    excludeBrand: null,

    gender: null,

    occasion: null,

    note: null,

    productType: null,

    categoryGroup: null,
  };
  //
  // -------------------------
  // Brands
  // -------------------------
  //

  const brands = await brandDictionary.getBrands();

  const fuse = new Fuse(brands, {
    keys: ["name", "slug"],
    threshold: 0.3,
  });

  const results = fuse.search(message);

  if (results.length) {
    entities.brand = results[0].item;

    if (results.length >= 2) {
      entities.comparisonProducts = [results[0].item, results[1].item];
    }
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //

  for (const [type, aliases] of Object.entries(productTypes)) {
    if (contains(aliases, text)) {
      entities.productType = type;
      break;
    }
  }

  //
  // -------------------------
  // Category Group
  // -------------------------
  //

  for (const [group, words] of Object.entries(categoryGroups)) {
    if (contains(words, text)) {
      entities.categoryGroup = {
        slug: group,
        name: group.replace(/-/g, " "),
      };

      break;
    }
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //

  for (const [gender, aliases] of Object.entries(genders)) {
    if (contains(aliases, text)) {
      entities.gender = gender;
      break;
    }
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //

  for (const [occasion, aliases] of Object.entries(occasions)) {
    if (contains(aliases, text)) {
      entities.occasion = occasion;
      break;
    }
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //

  for (const [note, aliases] of Object.entries(fragranceNotes)) {
    if (contains(aliases, text)) {
      entities.note = note;
      break;
    }
  }

  //
  // -------------------------
  // Recipient
  // -------------------------
  //

  for (const [recipient, aliases] of Object.entries(RECIPIENTS)) {
    if (contains(aliases, text)) {
      entities.recipient = recipient;
      break;
    }
  }

  //
  // -------------------------
  // Budget
  // -------------------------
  //

  entities.budget = detectBudget(text);

  //
  // -------------------------
  // Price Range
  // -------------------------
  //

  const prices = detectPriceRange(text);

  entities.minPrice = prices.minPrice;
  entities.maxPrice = prices.maxPrice;

  return entities;
}
