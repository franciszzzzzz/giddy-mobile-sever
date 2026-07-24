import aiProductService from "../../../services/aiProduct.service.js";

import logger from "../../../utils/logger.js";

let brands = [];

let lastRefresh = 0;

const CACHE_TIME = 1000 * 60 * 60; // 1 hour

export async function getBrands() {
  try {
    const now = Date.now();

    if (brands.length && now - lastRefresh < CACHE_TIME) {
      return brands;
    }

    const data = await aiProductService.getBrands();

    brands = data.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
    }));

    lastRefresh = now;

    logger.info({
      message: `Loaded ${brands.length} brands for Claire`,
    });

    return brands;
  } catch (error) {
    logger.error(error);

    return brands;
  }
}

export default {
  getBrands,
};
