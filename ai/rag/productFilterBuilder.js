// ai/rag/productFilterBuilder.js

import aiProductService from "../../services/aiProduct.service.js";

/**
 * Maps Claire product types to WooCommerce search terms.
 */
const PRODUCT_TYPE_SEARCH = {
  perfume: "perfume",

  body_mist: "body mist",

  body_spray: "body spray",

  perfume_oil: "perfume oil",

  deodorant: "deodorant",

  candle: "candle",

  diffuser: "diffuser",

  shampoo: "shampoo",

  conditioner: "conditioner",
};

/**
 * Converts an AI intent into WooCommerce filters.
 */
export async function buildFilters(intent) {
  const filters = {
    stockStatus: "instock",
    limit: 20,
  };

  //
  // --------------------------------------------------
  // Brand
  // --------------------------------------------------
  //
  if (intent.brand?.id) {
    filters.brand = intent.brand.id;
  }

  //
  // --------------------------------------------------
  // Product Type
  // --------------------------------------------------
  //
  if (intent.productType) {
    const search = PRODUCT_TYPE_SEARCH[intent.productType];

    if (search) {
      filters.search = search;
    }
  }

  //
  // --------------------------------------------------
  // Gender
  // --------------------------------------------------
  //
  if (intent.gender) {
    const categories = await aiProductService.getCategories();

    const match = categories.find((category) => {
      const slug = category.slug.toLowerCase();
      const name = category.name.toLowerCase();
      const gender = intent.gender.toLowerCase();

      return slug === gender || name === gender;
    });

    if (match) {
      filters.category = match.id;
    }
  }

  //
  // --------------------------------------------------
  // Future Filters
  // --------------------------------------------------
  //
  // intent.occasion
  // intent.note
  // intent.priceRange
  // intent.rating
  // intent.inStock
  //

  return filters;
}

export default {
  buildFilters,
};
