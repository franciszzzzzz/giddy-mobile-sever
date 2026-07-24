import aiProductService from "../../../services/aiProduct.service.js";

async function execute() {
  const brands = await aiProductService.getBrands();

  return {
    source: "brands",

    products: [],

    product: null,

    brands,

    categories: [],
  };
}

export default {
  execute,
};
