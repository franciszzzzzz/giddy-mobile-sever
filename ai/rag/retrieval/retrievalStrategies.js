import searchByKeyword from "./searchByKeyword.js";
import searchByBrand from "./searchByBrand.js";
import searchByCategory from "./searchByCategory.js";
import searchByProductType from "./searchByProductType.js";
import searchFeaturedProducts from "./searchFeaturedProducts.js";

/**
 * Every retrieval strategy has:
 *
 * key       -> internal identifier
 * name      -> human readable
 * condition -> should this strategy run?
 * execute   -> retrieval function
 *
 * retrieveProducts.js simply loops over this array.
 */

const RETRIEVAL_STRATEGIES = [
  {
    key: "category",

    name: "Category Group",

    condition(intent) {
      return Boolean(intent.categoryGroup);
    },

    execute: searchByCategory,
  },

  {
    key: "brand",

    name: "Brand",

    condition(intent) {
      return Boolean(intent.brand);
    },

    execute: searchByBrand,
  },

  {
    key: "productType",

    name: "Product Type",

    condition(intent) {
      return Boolean(intent.productType);
    },

    execute: searchByProductType,
  },

  {
    key: "keyword",

    name: "Keyword Search",

    condition(intent) {
      return Boolean(intent.query);
    },

    execute: searchByKeyword,
  },

  {
    key: "featured",

    name: "Featured Products",

    condition(intent) {
      return Boolean(intent.featured);
    },

    execute: searchFeaturedProducts,
  },
];

export default RETRIEVAL_STRATEGIES;
