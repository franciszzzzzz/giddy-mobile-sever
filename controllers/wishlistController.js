import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import {
  createWishlistSnapshotItem,
  fetchWishlistProduct,
  findWishlistItem,
  getOrCreateWishlist,
  getWishlistByCustomer,
  getWishlistCount,
  refreshWishlistSnapshot,
} from "../services/wishlistService.js";

export const addToWishlist = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  let { productId, variationId = null } = req.body;

  productId = Number(productId);
  variationId = variationId ? Number(variationId) : null;

  //
  // Validation
  //

  if (!productId) {
    return next(new HandleError("Product ID is required.", 400));
  }

  //
  // Fetch latest WooCommerce product
  //

  const product = await fetchWishlistProduct(productId, variationId);

  //
  // Find or Create Wishlist
  //

  const wishlist = await getOrCreateWishlist(customerId);

  //
  // Already Exists?
  //

  const existingItem = findWishlistItem(wishlist, productId, variationId);

  if (existingItem) {
    return res.status(200).json({
      success: true,
      message: "Product already exists in wishlist.",
      wishlist,
    });
  }

  //
  // Add New Item
  //

  wishlist.items.push(
    createWishlistSnapshotItem(product, productId, variationId),
  );

  await wishlist.save();

  return res.status(200).json({
    success: true,
    message: "Product added to wishlist.",
    wishlist,
  });
});

export const getWishlist = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  //
  // Get Wishlist
  //

  const wishlist = await getWishlistByCustomer(customerId);

  //
  // Empty Wishlist
  //

  if (!wishlist || wishlist.items.length === 0) {
    return res.status(200).json({
      success: true,
      totalItems: 0,
      items: [],
    });
  }

  //
  // Refresh Product Snapshots
  //

  await Promise.all(
    wishlist.items.map(async (item) => {
      try {
        const product = await fetchWishlistProduct(
          item.productId,
          item.variationId,
        );

        refreshWishlistSnapshot(item, product);
      } catch {
        // Product removed from WooCommerce
      }
    }),
  );

  await wishlist.save();

  return res.status(200).json({
    success: true,
    totalItems: wishlist.items.length,
    items: wishlist.items,
  });
});

export const removeFromWishlist = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  let { productId, variationId = null } = req.body;

  productId = Number(productId);
  variationId = variationId ? Number(variationId) : null;

  //
  // Get Wishlist
  //

  const wishlist = await getWishlistByCustomer(customerId);

  if (!wishlist) {
    return next(new HandleError("Wishlist not found.", 404));
  }

  //
  // Find Item
  //

  const index = wishlist.items.findIndex(
    (item) =>
      item.productId === productId &&
      (item.variationId ?? null) === variationId,
  );

  if (index === -1) {
    return next(new HandleError("Product not found in wishlist.", 404));
  }

  //
  // Remove Item
  //

  wishlist.items.splice(index, 1);

  await wishlist.save();

  return res.status(200).json({
    success: true,
    message: "Product removed from wishlist.",
    wishlist,
  });
});

export const clearWishlist = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  const wishlist = await getWishlistByCustomer(customerId);

  if (!wishlist) {
    return next(new HandleError("Wishlist not found.", 404));
  }

  wishlist.items = [];

  await wishlist.save();

  return res.status(200).json({
    success: true,
    message: "Wishlist cleared successfully.",
  });
});

export const getWishlistItemCount = handleAsyncError(async (req, res) => {
  const customerId = req.user.id;

  const totalItems = await getWishlistCount(customerId);

  return res.status(200).json({
    success: true,
    totalItems,
  });
});

export const checkWishlistItem = handleAsyncError(async (req, res) => {
  const customerId = req.user.id;

  const productId = Number(req.params.productId);
  const variationId = req.query.variationId
    ? Number(req.query.variationId)
    : null;

  const wishlist = await getWishlistByCustomer(customerId);

  const exists = wishlist
    ? !!findWishlistItem(wishlist, productId, variationId)
    : false;

  return res.status(200).json({
    success: true,
    exists,
  });
});
