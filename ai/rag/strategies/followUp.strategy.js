async function execute(intent) {
  return {
    source: "follow_up",

    products: intent.previousProducts || [],

    product: intent.previousProduct || null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
