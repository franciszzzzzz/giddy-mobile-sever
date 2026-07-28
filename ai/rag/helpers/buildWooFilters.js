// ai/rag/helpers/buildWooFilters.js

export default function buildWooFilters(intent = {}) {
  const filters = {
    page: 1,
    limit: 50,
  };

  //
  // -------------------------------------------------
  // Search
  // -------------------------------------------------
  //

  if (intent.query) {
    filters.search = intent.query;
  }

  //
  // -------------------------------------------------
  // Brand
  // -------------------------------------------------
  //

  if (intent.brand?.id) {
    filters.brand = intent.brand.id;
  }

  //
  // -------------------------------------------------
  // Category Group
  // -------------------------------------------------
  //
  // women
  // men
  // kids
  // unisex
  // gift-set
  // diffuser
  // scented-candle
  // hair-care
  //

  if (intent.categoryGroup) {
    filters.group = intent.categoryGroup;
  }

  //
  // -------------------------------------------------
  // Product Type
  // -------------------------------------------------
  //

  if (intent.productType) {
    filters.productType = intent.productType;
  }

  //
  // -------------------------------------------------
  // Gender
  // -------------------------------------------------
  //

  if (intent.gender) {
    filters.gender = intent.gender;
  }

  //
  // -------------------------------------------------
  // Occasion
  // -------------------------------------------------
  //

  if (intent.occasion) {
    filters.occasion = intent.occasion;
  }

  //
  // -------------------------------------------------
  // Fragrance Notes
  // -------------------------------------------------
  //

  if (intent.note) {
    filters.note = intent.note;
  }

  //
  // -------------------------------------------------
  // Budget
  // -------------------------------------------------
  //

  if (intent.budget) {
    filters.maxPrice = intent.budget;
  }

  //
  // -------------------------------------------------
  // Explicit Price Range
  // -------------------------------------------------
  //

  if (intent.minPrice != null) {
    filters.minPrice = intent.minPrice;
  }

  if (intent.maxPrice != null) {
    filters.maxPrice = intent.maxPrice;
  }

  //
  // -------------------------------------------------
  // Stock
  // -------------------------------------------------
  //

  if (intent.stockStatus) {
    filters.stockStatus = intent.stockStatus;
  }

  //
  // -------------------------------------------------
  // Featured
  // -------------------------------------------------
  //

  if (intent.featured === true) {
    filters.featured = true;
  }

  //
  // -------------------------------------------------
  // On Sale
  // -------------------------------------------------
  //

  if (intent.onSale === true) {
    filters.onSale = true;
  }

  //
  // -------------------------------------------------
  // Sorting
  // -------------------------------------------------
  //

  if (intent.sort) {
    filters.sort = intent.sort;
  }

  return filters;
}
