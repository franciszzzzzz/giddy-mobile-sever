import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";
import productTypes from "../../agent/dictionaries/productTypes.js";

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
  // Gender
  //
  if (intent.gender) {
    filtered = filtered.filter((product) =>
      product.categories?.some((category) =>
        category.toLowerCase().includes(intent.gender.toLowerCase()),
      ),
    );
  }

  //
  // Product Type
  //
  const requestedType = detectRequestedType(intent.query);

  if (requestedType) {
    filtered = filtered.filter((product) => {
      const searchable = [
        product.name,
        ...(product.categories || []),
        product.brand || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(requestedType);
    });
  }

  return filtered;
}

async function execute(intent) {
  let products = [];

  //
  // Brand search
  //
  if (intent.brand) {
    products = await aiProductService.findProducts({
      brand: intent.brand.id,
      limit: 50,
    });
  } else {
    //
    // Keyword search
    //
    products = await aiProductService.searchProducts(intent.query, {
      limit: 50,
    });
  }

  //
  // Filter
  //
  products = filterProducts(products, intent);

  return {
    source: "product_search",

    products: formatter.formatProducts(products),

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
