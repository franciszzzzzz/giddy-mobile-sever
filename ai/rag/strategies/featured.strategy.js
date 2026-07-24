import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute() {
  const products = await aiProductService.getFeaturedProducts();

  return {
    source: "featured",

    products: formatter.formatProducts(products),

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
