import aiProductService from "../../../services/aiProduct.service.js";

import logger from "../../../utils/logger.js";

let categories = [];

let lastRefresh = 0;

const CACHE_TIME = 1000 * 60 * 60;

export async function getCategories() {
  try {
    const now = Date.now();

    if (categories.length && now - lastRefresh < CACHE_TIME) {
      return categories;
    }

    const data = await aiProductService.getCategories();

    categories = data.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    }));

    lastRefresh = now;

    logger.info({
      message: `Loaded ${categories.length} categories`,
    });

    return categories;
  } catch (error) {
    logger.error(error);

    return categories;
  }
}

export default {
  getCategories,
};
