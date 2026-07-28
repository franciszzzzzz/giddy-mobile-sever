/**
 * Merges multiple arrays of WooCommerce products.
 *
 * Undefined or empty arrays are ignored.
 *
 * Example:
 *
 * mergeProducts(
 *     perfumes,
 *     featured,
 *     categoryProducts
 * )
 */
export default function mergeProducts(...collections) {
  const merged = [];

  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    merged.push(...collection);
  }

  return merged;
}
