import ShoppingCart from "../models/ShoppingCart.js";
import { wc } from "../config/db.js";
import HandleError from "./handleError.js";

/*
|--------------------------------------------------------------------------
| Find Cart
|--------------------------------------------------------------------------
*/

export const getOrCreateCart = async (customerId) => {
  let cart = await ShoppingCart.findOne({ customerId });

  if (!cart) {
    cart = await ShoppingCart.create({
      customerId,
      items: [],
    });
  }

  return cart;
};

export const findCartItem = (cart, productId, variationId = null) => {
  return cart.items.find(
    (item) =>
      item.productId === productId &&
      (item.variationId ?? null) === variationId,
  );
};
/*
|--------------------------------------------------------------------------
| Get Existing Cart
|--------------------------------------------------------------------------
*/

export const getCartByCustomer = async (customerId) => {
  return ShoppingCart.findOne({ customerId });
};

/*
|--------------------------------------------------------------------------
| Fetch Product + Variation
|--------------------------------------------------------------------------
*/

export const fetchProductSnapshot = async (productId, variationId = null) => {
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
| Stock Validation
|--------------------------------------------------------------------------
*/

export const validateStock = (product, quantity) => {
  if (
    product.manage_stock &&
    product.stock_quantity !== null &&
    quantity > Number(product.stock_quantity)
  ) {
    throw new HandleError("Insufficient stock.", 400);
  }
};

/*
|--------------------------------------------------------------------------
| Build Categories Snapshot
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
| Refresh Item Snapshot
|--------------------------------------------------------------------------
*/

export const refreshSnapshot = (item, product) => {
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
| Calculate Cart Totals
|--------------------------------------------------------------------------
*/

export const calculateTotals = (items) => {
  let subtotal = 0;
  let totalItems = 0;

  const formattedItems = items.map((item) => {
    const unitPrice = Number(item.salePrice || item.price || 0);

    const lineTotal = unitPrice * item.quantity;

    subtotal += lineTotal;
    totalItems += item.quantity;

    return {
      productId: item.productId,
      variationId: item.variationId,
      quantity: item.quantity,

      unitPrice,
      lineTotal,

      product: {
        id: item.productId,

        name: item.name,
        slug: item.slug,
        sku: item.sku,

        image: item.image,

        price: item.price,
        regularPrice: item.regularPrice,
        salePrice: item.salePrice,

        stockStatus: item.stockStatus,
        stockQuantity: item.stockQuantity,
        manageStock: item.manageStock,

        averageRating: item.averageRating,
        reviewCount: item.reviewCount,

        categories: item.categories,
      },

      addedAt: item.addedAt,
    };
  });

  return {
    subtotal,
    totalItems,
    items: formattedItems,
  };
};

/*
|--------------------------------------------------------------------------
| Delete Cart
|--------------------------------------------------------------------------*/

export const deleteCart = async (customerId) => {
  return ShoppingCart.findOneAndDelete({
    customerId,
  });
};

/*
|--------------------------------------------------------------------------
| Get Cart Count
|--------------------------------------------------------------------------
*/

export const getCartCount = async (customerId) => {
  const cart = await ShoppingCart.findOne(
    { customerId },
    { items: 1, _id: 0 },
  ).lean();

  if (!cart) {
    return 0;
  }

  return cart.items.reduce((count, item) => count + item.quantity, 0);
};

/*
|--------------------------------------------------------------------------
| Create Cart Snapshot Item
|--------------------------------------------------------------------------
*/

export const createSnapshotItem = (
  product,
  productId,
  variationId,
  quantity,
) => {
  return {
    productId,
    variationId,
    quantity,

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
