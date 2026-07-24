import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const products = await aiProductService.findProducts({
    search: intent.query,

    brand: intent.brand,

    minPrice: intent.minPrice,

    maxPrice: intent.maxPrice,

    stockStatus: "instock",
  });

  return {
    source: "recommendation",

    products: formatter.formatProducts(products),

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
