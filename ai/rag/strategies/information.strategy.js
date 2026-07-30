import { retrieve } from "../retrieval.service.js";

/**
 * Product Information Strategy
 *
 * Retrieves matching products using the shared RAG retrieval pipeline and
 * surfaces them so the LLM prompt and the frontend product carousel both
 * receive them.
 *
 * The primary product (context.product, or the first retrieved one) is kept
 * on `product` for detail-style consumers; the full retrieved list is kept on
 * `products`.
 *
 * `retrieve()` already formats the products via productFormatter, so they are
 * returned here as-is without re-formatting.
 */
async function execute(intent) {
  const context = await retrieve(intent);

  const products = context.products || [];

  //
  // --------------------------------------------------
  // Primary product
  // --------------------------------------------------
  //
  // Prefer a memory-resolved specific product, falling back to the first
  // retrieved one.
  //
  const product = context.product || products[0] || null;

  return {
    source: "information",

    products,

    product,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};

