import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

function filterProducts(products, intent) {
  let filtered = [...products];

  //
  // Filter by gender
  //
  if (intent.gender) {
    filtered = filtered.filter((product) =>
      product.categories?.some((category) =>
        category.name.toLowerCase().includes(intent.gender.toLowerCase()),
      ),
    );
  }

  //
  // Detect requested product type from the user's query.
  //
  const query = (intent.query || "").toLowerCase();

  const productTypes = [
    "perfume",
    "body mist",
    "body spray",
    "antiperspirant",
    "fragrance oil",
    "reed diffuser",
    "candle",
  ];

  const requestedType = productTypes.find((type) => query.includes(type));

  if (requestedType) {
    filtered = filtered.filter((product) => {
      const text = (
        product.name +
        " " +
        product.categories.map((c) => c.name).join(" ")
      ).toLowerCase();

      return text.includes(requestedType);
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
  // Filter products before sending to the LLM
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
