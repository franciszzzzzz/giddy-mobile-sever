import brandDictionary from "../dynamic/brands.js";

import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";

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

export default async function extractEntities(message) {
  const text = message.toLowerCase();

  const entities = {
    brand: null,
    gender: null,
    occasion: null,
    note: null,
  };

  //
  // Dynamic WooCommerce Tags
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
  // Gender
  //
  for (const [gender, words] of Object.entries(genders)) {
    if (words.some((word) => text.includes(word))) {
      entities.gender = gender;
      break;
    }
  }

  //
  // Occasion
  //
  for (const [occasion, words] of Object.entries(occasions)) {
    if (words.some((word) => text.includes(word))) {
      entities.occasion = occasion;
      break;
    }
  }

  //
  // Fragrance Notes
  //
  for (const [note, words] of Object.entries(fragranceNotes)) {
    if (words.some((word) => text.includes(word))) {
      entities.note = note;
      break;
    }
  }

  return entities;
}
