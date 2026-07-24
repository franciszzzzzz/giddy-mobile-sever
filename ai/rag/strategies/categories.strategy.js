import aiProductService from "../../../services/aiProduct.service.js";

async function execute() {
  const categories = await aiProductService.getCategories();

  return {
    source: "categories",

    products: [],

    product: null,

    brands: [],

    categories,
  };
}

export default {
  execute,
};
