import RETRIEVAL_STRATEGIES from "./retrievalStrategies.js";

import mergeProducts from "../helpers/mergeProducts.js";
import removeDuplicates from "../helpers/removeDuplicates.js";
import productMatchesIntent from "../helpers/productMatchesIntent.js";

import { rankProducts } from "../productRanker.js";
import expandIntent from "../query/expandIntent.js";

/**
 * Main retrieval orchestrator.
 *
 * Determines which retrieval strategies should execute,
 * merges the results, removes duplicates,
 * ranks them and finally applies semantic filtering.
 *
 * The intent is expanded before retrieval begins,
 * stripping conversational filler so that downstream
 * searches receive clean, targeted search terms.
 */
export default async function retrieveProducts(intent = {}) {
  //
  // --------------------------------------------------
  // Expand Intent
  // --------------------------------------------------
  //
  // Transforms the raw conversational query into
  // clean search terms before any retrieval happens.
  //
  const expandedIntent = expandIntent(intent);

  //
  // --------------------------------------------------
  // Execute matching retrieval strategies
  // --------------------------------------------------
  //

  const retrievals = [];

  for (const strategy of RETRIEVAL_STRATEGIES) {
    if (!strategy.condition(expandedIntent)) {
      continue;
    }

    retrievals.push(strategy.execute(expandedIntent));
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

  products = rankProducts(products, expandedIntent);

  //
  // --------------------------------------------------
  // Final semantic filtering
  // --------------------------------------------------
  //

  products = products.filter((product) =>
    productMatchesIntent(product, expandedIntent),
  );

  return products;
}
