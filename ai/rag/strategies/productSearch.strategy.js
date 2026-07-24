import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const products = await aiProductService.searchProducts(intent.query);

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
