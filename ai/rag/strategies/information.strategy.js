import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const product = await aiProductService.getProduct(intent.productId);

  return {
    source: "information",

    products: [],

    product: formatter.formatProduct(product),

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
