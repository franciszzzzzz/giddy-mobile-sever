import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const products = await aiProductService.getSimilarProducts(intent.productId);

  return {
    source: "similar",

    products: formatter.formatProducts(products),

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
