/**
 * Shared filtering utilities for Claire.
 * These operate on products already retrieved from WooCommerce
 * so Claire can refine previous results without making another API call.
 */

function normalize(value) {
  return String(value || "").toLowerCase();
}

function categories(product) {
  return (product.categories || []).map(normalize);
}

function searchableText(product) {
  return [
    product.name,
    product.brand,
    ...(product.categories || []),
    product.shortDescription,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * ----------------------------------------
 * Product Type
 * ----------------------------------------
 */

export function filterByProductType(products, aliases = []) {
  if (!aliases.length) {
    return products;
  }

  return products.filter((product) => {
    const text = searchableText(product);

    return aliases.some((alias) => text.includes(alias.toLowerCase()));
  });
}

/**
 * ----------------------------------------
 * Gender
 * ----------------------------------------
 */

export function filterByGender(products, gender) {
  if (!gender) {
    return products;
  }

  return products.filter((product) =>
    categories(product).some((category) =>
      category.includes(gender.toLowerCase()),
    ),
  );
}

/**
 * ----------------------------------------
 * Stock
 * ----------------------------------------
 */

export function filterInStock(products) {
  return products.filter((product) => product.inStock);
}

/**
 * ----------------------------------------
 * Brand
 * ----------------------------------------
 */

export function filterByBrand(products, brandName) {
  if (!brandName) {
    return products;
  }

  return products.filter((product) =>
    normalize(product.brand).includes(brandName.toLowerCase()),
  );
}

/**
 * ----------------------------------------
 * Price Sorting
 * ----------------------------------------
 */

export function sortByCheapest(products) {
  return [...products].sort(
    (a, b) => Number(a.price || 0) - Number(b.price || 0),
  );
}

export function sortByMostExpensive(products) {
  return [...products].sort(
    (a, b) => Number(b.price || 0) - Number(a.price || 0),
  );
}

/**
 * ----------------------------------------
 * Rating Sorting
 * ----------------------------------------
 */

export function sortByHighestRated(products) {
  return [...products].sort(
    (a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0),
  );
}

/**
 * ----------------------------------------
 * Generic refinement
 * ----------------------------------------
 */

export function refineProducts(products, intent, productTypeAliases = []) {
  let result = [...products];

  result = filterByGender(result, intent.gender);

  result = filterByProductType(result, productTypeAliases);

  const query = normalize(intent.query);

  //
  // Stock
  //

  if (query.includes("in stock") || query.includes("available")) {
    result = filterInStock(result);
  }

  //
  // Cheapest
  //

  if (
    query.includes("cheapest") ||
    query.includes("lowest price") ||
    query.includes("least expensive")
  ) {
    result = sortByCheapest(result);
  }

  //
  // Most expensive
  //

  if (
    query.includes("most expensive") ||
    query.includes("highest price") ||
    query.includes("costliest")
  ) {
    result = sortByMostExpensive(result);
  }

  //
  // Highest rated
  //

  if (
    query.includes("highest rated") ||
    query.includes("best rated") ||
    query.includes("top rated")
  ) {
    result = sortByHighestRated(result);
  }

  return result;
}

export default {
  refineProducts,
  filterByGender,
  filterByProductType,
  filterByBrand,
  filterInStock,
  sortByCheapest,
  sortByMostExpensive,
  sortByHighestRated,
};
