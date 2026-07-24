import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const products = await Promise.all(
    intent.products.map((id) => aiProductService.getProduct(id)),
  );

  return {
    source: "comparison",

    products: formatter.formatProducts(products),

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
