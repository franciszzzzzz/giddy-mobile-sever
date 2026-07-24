import brandDictionary from "../dynamic/brands.js";

import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";

const PRODUCT_TYPES = {
  perfume: ["perfume", "perfumes"],

  body_mist: ["body mist", "body mists", "mist", "mists"],

  body_spray: ["body spray", "body sprays"],

  perfume_oil: ["perfume oil", "perfume oils", "oil", "oils"],

  deodorant: [
    "deodorant",
    "deodorants",
    "roll on",
    "roll-on",
    "rollon",
    "roll ons",
  ],

  shampoo: ["shampoo", "shampoos"],

  conditioner: [
    "conditioner",
    "conditioners",
    "leave in conditioner",
    "deep conditioner",
  ],

  candle: ["candle", "candles", "scented candle", "scented candles"],

  diffuser: ["diffuser", "diffusers"],
};

const IGNORED_TAGS = [
  "perfume",
  "fragrance",
  "gift",
  "men",
  "women",
  "kids",
  "body spray",
  "body mist",
  "rollon",
  "rollons",
  "hair",
  "shampoo",
  "conditioner",
  "leave-in conditioner",
  "deep conditioner",
  "perfume oil",
  "scented candle",
  "diffuser",
];

/**
 * Checks if any word inside a dictionary array exists in the message
 * using strict regex word boundaries (\b).
 */
function matchWordWithBoundaries(wordsArray, targetText) {
  return wordsArray.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(targetText);
  });
}

export default async function extractEntities(message) {
  const text = message.toLowerCase();

  const entities = {
    brand: null,
    gender: null,
    occasion: null,
    note: null,
    productType: null,
  };

  //
  // -------------------------
  // Brand
  // -------------------------
  //

  const brands = await brandDictionary.getBrands();

  const matches = brands
    .filter((brand) => {
      const name = brand.name.toLowerCase();
      const slug = brand.slug.toLowerCase();

      if (IGNORED_TAGS.includes(name)) {
        return false;
      }

      return text.includes(name) || text.includes(slug);
    })
    .sort((a, b) => b.name.length - a.name.length);

  entities.brand = matches[0] || null;

  //
  // -------------------------
  // Product Type
  // -------------------------
  //

  for (const [type, words] of Object.entries(PRODUCT_TYPES)) {
    if (matchWordWithBoundaries(words, text)) {
      entities.productType = type;
      break;
    }
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //

  for (const [gender, words] of Object.entries(genders)) {
    if (matchWordWithBoundaries(words, text)) {
      entities.gender = gender;
      break;
    }
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //

  for (const [occasion, words] of Object.entries(occasions)) {
    if (matchWordWithBoundaries(words, text)) {
      entities.occasion = occasion;
      break;
    }
  }

  //
  // -------------------------
  // Notes
  // -------------------------
  //

  for (const [note, words] of Object.entries(fragranceNotes)) {
    if (matchWordWithBoundaries(words, text)) {
      entities.note = note;
      break;
    }
  }

  return entities;
}
