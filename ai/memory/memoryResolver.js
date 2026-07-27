function hasValue(value) {
  return value !== null && value !== undefined;
}

function findReferencedProduct(query, products = []) {
  if (!query || !products.length) {
    return null;
  }

  const text = query.toLowerCase();

  if (text.includes("first")) return products[0] || null;
  if (text.includes("second")) return products[1] || null;
  if (text.includes("third")) return products[2] || null;
  if (text.includes("fourth")) return products[3] || null;
  if (text.includes("last")) return products[products.length - 1] || null;

  if (
    text.includes("cheapest") ||
    text.includes("lowest price") ||
    text.includes("least expensive")
  ) {
    return [...products].sort(
      (a, b) => Number(a.price || 0) - Number(b.price || 0),
    )[0];
  }

  if (
    text.includes("most expensive") ||
    text.includes("highest price") ||
    text.includes("costliest")
  ) {
    return [...products].sort(
      (a, b) => Number(b.price || 0) - Number(a.price || 0),
    )[0];
  }

  return null;
}

export default function resolveIntentWithMemory(intent, memory) {
  if (!memory) {
    return intent;
  }

  const resolved = {
    ...intent,
  };

  //
  // Only FOLLOW_UP intents inherit previous context.
  //
  if (resolved.type === "FOLLOW_UP") {
    if (!hasValue(resolved.brand) && memory.lastBrand) {
      resolved.brand = memory.lastBrand;
    }

    if (!hasValue(resolved.productType) && memory.lastProductType) {
      resolved.productType = memory.lastProductType;
    }

    if (!hasValue(resolved.gender) && memory.lastGender) {
      resolved.gender = memory.lastGender;
    }

    if (!hasValue(resolved.note) && memory.lastNote) {
      resolved.note = memory.lastNote;
    }

    if (!hasValue(resolved.occasion) && memory.lastOccasion) {
      resolved.occasion = memory.lastOccasion;
    }

    resolved.previousProducts = memory.lastProducts || [];

    resolved.previousProduct = memory.lastProduct || null;
  }

  //
  // Resolve things like:
  // "the first one"
  // "the cheapest"
  // "the last one"
  //
  const products =
    resolved.previousProducts?.length > 0
      ? resolved.previousProducts
      : memory.lastProducts;

  const referencedProduct = findReferencedProduct(resolved.query, products);

  if (referencedProduct) {
    resolved.product = referencedProduct;
  }

  return resolved;
}
