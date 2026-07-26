// ai/rag/productFilterBuilder.js

import aiProductService from "../../services/aiProduct.service.js";

/**
 * Converts an AI intent into WooCommerce filters.
 */
export async function buildFilters(intent) {
  const filters = {
    stockStatus: "instock",
    limit: 20,
  };

  //
  // -------------------------
  // Brand
  // -------------------------
  //
  if (intent.brand) {
    filters.brand = intent.brand.id;
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //
  if (intent.productType) {
    switch (intent.productType) {
      case "perfume":
        filters.search = "perfume";
        break;

      case "body_mist":
        filters.search = "body mist";
        break;

      case "body_spray":
        filters.search = "body spray";
        break;

      case "perfume_oil":
        filters.search = "perfume oil";
        break;

      case "deodorant":
        filters.search = "deodorant";
        break;

      case "candle":
        filters.search = "candle";
        break;

      case "diffuser":
        filters.search = "diffuser";
        break;

      default:
        break;
    }
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //
  if (intent.gender) {
    const categories = await aiProductService.getCategories();

    const match = categories.find(
      (category) =>
        category.slug.toLowerCase() === intent.gender.toLowerCase() ||
        category.name.toLowerCase() === intent.gender.toLowerCase(),
    );

    if (match) {
      filters.category = match.id;
    }
  }

  //
  // Future:
  // Occasion
  // Fragrance Notes
  // Price Range
  //

  return filters;
}

export default {
  buildFilters,
};
