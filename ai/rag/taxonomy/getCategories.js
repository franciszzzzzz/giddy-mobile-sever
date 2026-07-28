import { wc } from "../../../config/db.js";

/**
 * Retrieves all WooCommerce product categories.
 *
 * Returns:
 * [
 *   {
 *      id,
 *      name,
 *      slug,
 *      count
 *   }
 * ]
 */
export default async function getCategories() {
  const response = await wc.get("/products/categories", {
    params: {
      per_page: 100,
    },
  });

  return response.data;
}
