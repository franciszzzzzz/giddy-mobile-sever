import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";
import { rankProducts } from "../productRanker.js";
import productTypes from "../../agent/dictionaries/productTypes.js";
import { buildFilters } from "../retrieveProducts.js";

function detectRequestedType(query = "") {
  const text = query.toLowerCase();

  for (const aliases of Object.values(productTypes)) {
    const match = aliases.find((alias) => text.includes(alias));

    if (match) {
      return match;
    }
  }

  return null;
}

function filterProducts(products, intent) {
  let filtered = [...products];

  //
  // Brand
  //
  if (intent.brand) {
    const brandName = intent.brand.name.toLowerCase();

    filtered = filtered.filter((product) =>
      (product.tags || []).some((tag) => tag.name.toLowerCase() === brandName),
    );
  }

  //
  // Gender
  //
  if (intent.gender) {
    filtered = filtered.filter((product) =>
      product.categories?.some((category) =>
        category.name.toLowerCase().includes(intent.gender.toLowerCase()),
      ),
    );
  }

  //
  // Product Type
  //
  const requestedType = intent.productType || detectRequestedType(intent.query);

  if (requestedType) {
    filtered = filtered.filter((product) => {
      const searchable = [
        product.name,
        ...(product.categories?.map((c) => c.name) || []),
        ...(product.tags?.map((t) => t.name) || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(requestedType.replace("_", " "));
    });
  }

  return filtered;
}

async function execute(intent) {
  const filters = await buildFilters(intent);

  let products = await aiProductService.findProducts(filters);

  products = filterProducts(products, intent);

  products = rankProducts(products, intent);

  return {
    source: "recommendation",
    products: formatter.formatProducts(products.slice(0, 10)),
    product: null,
    brands: [],
    categories: [],
  };
}

export default {
  execute,
};
