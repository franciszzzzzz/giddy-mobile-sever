import { wc } from "../../../config/db.js";

/**
 * Retrieves all product brands (WooCommerce tags).
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
export default async function getBrands() {
  const response = await wc.get("/products/tags", {
    params: {
      per_page: 100,
    },
  });

  return response.data;
}
