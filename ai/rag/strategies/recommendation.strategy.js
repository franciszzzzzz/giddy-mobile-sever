import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  const products = await aiProductService.findProducts({
    search: intent.productType,

    brand: intent.brand?.id,

    gender: intent.gender,

    occasion: intent.occasion,

    note: intent.note,

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
