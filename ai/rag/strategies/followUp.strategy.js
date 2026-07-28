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
  return {
    source: "follow_up",

    products: intent.previousProducts ?? [],

    product: intent.product ?? intent.previousProduct ?? null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
