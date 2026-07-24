import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute() {
  const product = await aiProductService.getProductOfTheWeek();

  return {
    source: "product_of_the_week",

    products: [],

    product: formatter.formatProduct(product),

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
