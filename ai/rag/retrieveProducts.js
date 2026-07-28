import aiProductService from "../../services/aiProduct.service.js";

function buildSearchQuery(intent) {
  const parts = [];

  // Brand
  if (intent.brand?.name) {
    parts.push(intent.brand.name);
  }

  // Product type
  if (intent.productType) {
    parts.push(intent.productType.replace(/_/g, " "));
  }

  // Recipient
  if (intent.recipient) {
    parts.push(intent.recipient);
  }

  // Gender
  if (intent.gender) {
    parts.push(intent.gender);
  }

  // Occasion
  if (intent.occasion) {
    parts.push(intent.occasion);
  }

  // Fragrance Note
  if (intent.note) {
    parts.push(intent.note);
  }

  // If we extracted nothing useful,
  // fall back to the user's original message.
  if (parts.length === 0 && intent.query) {
    parts.push(intent.query);
  }

  return parts.join(" ");
}

export async function buildFilters(intent) {
  const filters = {
    page: 1,
    limit: 50,
  };

  //
  // -----------------------------------
  // Search Query
  // -----------------------------------
  //

  filters.search = buildSearchQuery(intent);

  //
  // -----------------------------------
  // Brand
  // -----------------------------------
  //

  if (intent.brand?.id) {
    filters.brand = intent.brand.id;
  }

  //
  // -----------------------------------
  // Budget
  // -----------------------------------
  //

  if (intent.budget) {
    filters.maxPrice = intent.budget;
  }

  //
  // -----------------------------------
  // Explicit Price Range
  // -----------------------------------
  //

  if (intent.minPrice) {
    filters.minPrice = intent.minPrice;
  }

  if (intent.maxPrice) {
    filters.maxPrice = intent.maxPrice;
  }

  //
  // -----------------------------------
  // Product Type
  // -----------------------------------
  //

  if (intent.productType) {
    const categories = await aiProductService.getCategories();

    const match = categories.find((category) => {
      const name = category.name.toLowerCase();
      const slug = category.slug.toLowerCase();

      return (
        name.includes(intent.productType.replace("_", " ")) ||
        slug.includes(intent.productType.replace("_", "-"))
      );
    });

    if (match) {
      filters.category = match.id;
    }
  }

  return filters;
}

export default {
  buildFilters,
};
