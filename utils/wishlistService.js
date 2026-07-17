import Wishlist from "../models/wishlist.js";
import { wc } from "../config/db.js";
import HandleError from "./handleError.js";

/*
|--------------------------------------------------------------------------
| Find Wishlist
|--------------------------------------------------------------------------
*/

export const getOrCreateWishlist = async (customerId) => {
  let wishlist = await Wishlist.findOne({ customerId });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      customerId,
      items: [],
    });
  }

  return wishlist;
};

export const getWishlistByCustomer = async (customerId) => {
  return Wishlist.findOne({ customerId });
};

export const findWishlistItem = (wishlist, productId, variationId = null) => {
  return wishlist.items.find(
    (item) =>
      item.productId === productId &&
      (item.variationId ?? null) === variationId,
  );
};

/*
|--------------------------------------------------------------------------
| Fetch Product + Variation
|--------------------------------------------------------------------------
*/

export const fetchWishlistProduct = async (productId, variationId = null) => {
  let product;

  try {
    const { data } = await wc.get(`/products/${productId}`);
    product = data;
  } catch {
    throw new HandleError("Product not found.", 404);
  }

  if (variationId) {
    try {
      const { data: variation } = await wc.get(
        `/products/${productId}/variations/${variationId}`,
      );

      product = {
        ...product,
        ...variation,
      };
    } catch {
      throw new HandleError("Variation not found.", 404);
    }
  }

  return product;
};

/*
|--------------------------------------------------------------------------
| Build Categories
|--------------------------------------------------------------------------
*/

export const buildCategories = (product) => {
  return (product.categories || []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
  }));
};

/*
|--------------------------------------------------------------------------
| Refresh Snapshot
|--------------------------------------------------------------------------
*/

export const refreshWishlistSnapshot = (item, product) => {
  item.name = product.name;
  item.slug = product.slug;
  item.sku = product.sku;

  item.image = product.images?.[0]?.src || null;

  item.price = product.price;
  item.regularPrice = product.regular_price;
  item.salePrice = product.sale_price;

  item.stockStatus = product.stock_status;
  item.manageStock = product.manage_stock;
  item.stockQuantity = product.stock_quantity;

  item.averageRating = product.average_rating;
  item.reviewCount = product.rating_count;

  item.categories = buildCategories(product);
};

/*
|--------------------------------------------------------------------------
| Create Wishlist Snapshot
|--------------------------------------------------------------------------
*/

export const createWishlistSnapshotItem = (product, productId, variationId) => {
  return {
    productId,
    variationId,

    name: product.name,
    slug: product.slug,
    sku: product.sku,

    image: product.images?.[0]?.src || null,

    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,

    stockStatus: product.stock_status,
    manageStock: product.manage_stock,
    stockQuantity: product.stock_quantity,

    averageRating: product.average_rating,
    reviewCount: product.rating_count,

    categories: buildCategories(product),
  };
};

/*
|--------------------------------------------------------------------------
| Delete Wishlist
|--------------------------------------------------------------------------
*/

export const deleteWishlist = async (customerId) => {
  return Wishlist.findOneAndDelete({ customerId });
};

/*
|--------------------------------------------------------------------------
| Wishlist Count
|--------------------------------------------------------------------------
*/

export const getWishlistCount = async (customerId) => {
  const wishlist = await Wishlist.findOne(
    { customerId },
    { items: 1, _id: 0 },
  ).lean();

  if (!wishlist) {
    return 0;
  }

  return wishlist.items.length;
};
