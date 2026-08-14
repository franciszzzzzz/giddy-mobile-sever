/**
 * Follow-up Strategy
 *
 * Uses conversation memory that has already been
 * resolved by the memory layer.
 *
 * No retrieval is performed here because the memory
 * resolver has already identified the relevant products.
 */
async function execute(intent) {
  const previous = intent.previousProducts ?? [];

  //
  // --------------------------------------------------
  // "Show more options" / "anything else"
  // --------------------------------------------------
  //
  // The memory resolver flags these with skipCurrentProduct because the user
  // has already seen the first result. Rotating the list past the primary
  // product surfaces DIFFERENT items instead of repeating the same carousel.
  //
  const products =
    intent.skipCurrentProduct && previous.length > 1
      ? previous.slice(1)
      : previous;

  //
  // --------------------------------------------------
  // Primary product
  // --------------------------------------------------
  //
  // After rotation the old primary is intentionally dropped; the new primary
  // is whatever now leads the list.
  //
  const product = intent.skipCurrentProduct
    ? products[0] ?? null
    : intent.product ?? intent.previousProduct ?? null;

  return {
    source: "follow_up",

    products,

    product,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
