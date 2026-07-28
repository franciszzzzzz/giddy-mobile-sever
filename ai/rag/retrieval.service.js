import retrieveProducts from "./retrieval/retrieveProducts.js";

import formatter from "./productFormatter.js";
import { rankProducts } from "./productRanker.js";

/**
 * Claire Retrieval Service
 *
 * Single entry point into the RAG retrieval layer.
 *
 * Responsibilities:
 * - retrieve products
 * - rank them
 * - format them
 */
export async function retrieve(intent = {}) {
  //
  // ----------------------------------------
  // Retrieve Products
  // ----------------------------------------
  //

  let products = await retrieveProducts(intent);

  //
  // ----------------------------------------
  // Rank Products
  // ----------------------------------------
  //

  products = rankProducts(products, intent);

  //
  // ----------------------------------------
  // Format Products
  // ----------------------------------------
  //

  const formattedProducts = formatter.formatProducts(products);

  return {
    source: "rag",

    products: formattedProducts,

    product: formattedProducts[0] || null,

    brands: [],

    categories: [],
  };
}

export default {
  retrieve,
};
