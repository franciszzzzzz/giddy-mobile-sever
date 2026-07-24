import brandDictionary from "../dynamic/brands.js";

import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";

export default async function extractEntities(message) {
  const text = message.toLowerCase();

  const entities = {
    brand: null,
    gender: null,
    occasion: null,
    note: null,
  };

  //
  // Dynamic Brands
  //
  const brands = await brandDictionary.getBrands();

  for (const brand of brands) {
    if (
      text.includes(brand.name.toLowerCase()) ||
      text.includes(brand.slug.toLowerCase())
    ) {
      entities.brand = brand;
      break;
    }
  }

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
