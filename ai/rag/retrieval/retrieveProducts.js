import RETRIEVAL_STRATEGIES from "./retrievalStrategies.js";

import mergeProducts from "../helpers/mergeProducts.js";
import removeDuplicates from "../helpers/removeDuplicates.js";
import productMatchesIntent from "../helpers/productMatchesIntent.js";

import { rankProducts } from "../productRanker.js";

/**
 * Main retrieval orchestrator.
 *
 * Determines which retrieval strategies should execute,
 * merges the results, removes duplicates,
 * ranks them and finally applies semantic filtering.
 */
export default async function retrieveProducts(intent = {}) {
  const retrievals = [];

  //
  // --------------------------------------------------
  // Execute matching retrieval strategies
  // --------------------------------------------------
  //

  for (const strategy of RETRIEVAL_STRATEGIES) {
    if (!strategy.condition(intent)) {
      continue;
    }

    retrievals.push(strategy.execute(intent));
  }

  //
  // --------------------------------------------------
  // Nothing matched
  // --------------------------------------------------
  //

  if (!retrievals.length) {
    return [];
  }

  //
  // --------------------------------------------------
  // Execute all retrievals simultaneously
  // --------------------------------------------------
  //

  const responses = await Promise.all(retrievals);

  //
  // --------------------------------------------------
  // Merge all results
  // --------------------------------------------------
  //

  let products = mergeProducts(...responses);

  //
  // --------------------------------------------------
  // Remove duplicates
  // --------------------------------------------------
  //

  products = removeDuplicates(products);

  //
  // --------------------------------------------------
  // Rank products
  // --------------------------------------------------
  //

  products = rankProducts(products, intent);

  //
  // --------------------------------------------------
  // Final semantic filtering
  // --------------------------------------------------
  //

  products = products.filter((product) =>
    productMatchesIntent(product, intent),
  );

  return products;
}
