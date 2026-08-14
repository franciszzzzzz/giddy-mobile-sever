function hasValue(value) {
  return value !== null && value !== undefined;
}

function findReferencedProduct(query = "", products = []) {
  if (!products.length) {
    return null;
  }

  const text = query.toLowerCase();

  //
  // -------------------------------------
  // Position
  // -------------------------------------
  //

  if (text.includes("first")) {
    return products[0] || null;
  }

  if (text.includes("second")) {
    return products[1] || null;
  }

  if (text.includes("third")) {
    return products[2] || null;
  }

  if (text.includes("fourth")) {
    return products[3] || null;
  }

  if (text.includes("last")) {
    return products[products.length - 1] || null;
  }

  //
  // -------------------------------------
  // Current Product
  // -------------------------------------
  //

  if (
    text.includes("it") ||
    text.includes("this") ||
    text.includes("that") ||
    text.includes("this one") ||
    text.includes("that one") ||
    text.includes("the perfume") ||
    text.includes("the fragrance")
  ) {
    return products[0] || null;
  }

  //
  // -------------------------------------
  // Cheapest
  // -------------------------------------
  //

  if (
    text.includes("cheapest") ||
    text.includes("cheaper") ||
    text.includes("less expensive") ||
    text.includes("lowest price")
  ) {
    return [...products].sort(
      (a, b) => Number(a.price || 0) - Number(b.price || 0),
    )[0];
  }

  //
  // -------------------------------------
  // Most Expensive
  // -------------------------------------
  //

  if (
    text.includes("expensive") ||
    text.includes("premium") ||
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
  // -------------------------------------
  // Inherit conversation state
  // -------------------------------------
  //

  if (!hasValue(resolved.brand)) {
    resolved.brand = memory.lastBrand;
  }

  if (!hasValue(resolved.gender)) {
    resolved.gender = memory.lastGender;
  }

  if (!hasValue(resolved.productType)) {
    resolved.productType = memory.lastProductType;
  }

  // Saved by updateConversation as memory.lastCategory. Inheriting it lets a
  // follow-up like "gift sets then" keep the men/women context; expandIntent
  // still drops it unless the user actually mentions the group again.
  if (!hasValue(resolved.categoryGroup)) {
    resolved.categoryGroup = memory.lastCategory;
  }

  if (!hasValue(resolved.note)) {
    resolved.note = memory.lastNote;
  }

  if (!hasValue(resolved.occasion)) {
    resolved.occasion = memory.lastOccasion;
  }

  if (!hasValue(resolved.recipient)) {
    resolved.recipient = memory.lastRecipient;
  }

  if (!hasValue(resolved.budget)) {
    resolved.budget = memory.lastBudget;
  }

  if (!hasValue(resolved.minPrice)) {
    resolved.minPrice = memory.lastMinPrice;
  }

  if (!hasValue(resolved.maxPrice)) {
    resolved.maxPrice = memory.lastMaxPrice;
  }

  //
  // -------------------------------------
  // Previous Products
  // -------------------------------------
  //

  resolved.previousProducts = memory.lastProducts || [];

  resolved.previousProduct = memory.lastProduct || null;

  //
  // -------------------------------------
  // Resolve "first", "it", etc.
  // -------------------------------------
  //

  const referencedProduct = findReferencedProduct(
    resolved.query,
    resolved.previousProducts,
  );

  if (referencedProduct) {
    resolved.product = referencedProduct;
  }

  //
  // -------------------------------------
  // Conversation Actions
  // -------------------------------------
  //

  const text = resolved.query.toLowerCase();

  //
  // User wants another recommendation
  //

  if (
    text.includes("another") ||
    text.includes("something else") ||
    text.includes("different one") ||
    text.includes("show more") ||
    text.includes("more options")
  ) {
    resolved.skipCurrentProduct = true;
  }

  //
  // User rejected current brand
  //

  if (
    text.includes("not this") ||
    text.includes("don't like") ||
    text.includes("dont like") ||
    text.includes("anything else")
  ) {
    if (memory.lastBrand) {
      resolved.excludeBrand = memory.lastBrand;
    }

    resolved.skipCurrentProduct = true;
  }

  return resolved;
}
