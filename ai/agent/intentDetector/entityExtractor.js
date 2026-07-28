import Fuse from "fuse.js";

import brandDictionary from "../dynamic/brands.js";

import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";

const PRODUCT_TYPES = {
  perfume: ["perfume", "perfumes", "fragrance", "fragrances"],

  body_mist: ["body mist", "body mists", "mist", "mists"],

  body_spray: ["body spray", "body sprays"],

  perfume_oil: ["perfume oil", "perfume oils", "oil", "oils"],

  deodorant: ["deodorant", "deodorants", "roll on", "roll-on", "rollon"],

  shampoo: ["shampoo", "shampoos"],

  conditioner: ["conditioner", "conditioners"],

  diffuser: ["diffuser", "diffusers"],

  candle: ["candle", "candles"],

  gift_set: ["gift set", "gift sets", "giftset", "giftsets"],
};

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

const STOP_WORDS = [
  "show",
  "find",
  "recommend",
  "search",
  "want",
  "need",
  "buy",
  "please",
  "give",
  "me",
];

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

    recipient: null,

    budget: null,

    minPrice: null,
    maxPrice: null,

    product: null,

    comparisonProducts: [],
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

  for (const [type, aliases] of Object.entries(PRODUCT_TYPES)) {
    if (contains(aliases, text)) {
      entities.productType = type;
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
