/**
 * Removes duplicate WooCommerce products.
 *
 * Duplicates are identified by product ID.
 *
 * Example:
 *
 * [1,2,3]
 * +
 * [2,3,4]
 *
 * becomes
 *
 * [1,2,3,4]
 */
export default function removeDuplicates(products = []) {
  const seen = new Set();

  return products.filter((product) => {
    if (!product?.id) {
      return false;
    }

    if (seen.has(product.id)) {
      return false;
    }

    seen.add(product.id);

    return true;
  });
}
