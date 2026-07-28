import getCategories from "./getCategories.js";

/**
 * Returns all category IDs that belong to a group.
 *
 * Examples:
 *
 * women
 * -> [women parent + all children]
 *
 * men
 * -> [men parent + all children]
 *
 * kids
 * -> [boys parent + girls parent + all their children]
 *
 * @param {string} slug
 * @returns {Promise<Array<number>>}
 */
export default async function getCategoryGroup(slug) {
  if (!slug) {
    return [];
  }

  const categories = await getCategories();

  const value = slug.toLowerCase();

  //
  // -----------------------------------------
  // Kids
  // -----------------------------------------
  //
  if (value === "kids") {
    const boys = categories.find((category) => category.slug === "boys");

    const girls = categories.find((category) => category.slug === "girls");

    const collectChildren = (parent) => {
      if (!parent) {
        return [];
      }

      const children = categories.filter(
        (category) => category.parent === parent.id,
      );

      return [parent.id, ...children.map((child) => child.id)];
    };

    return [...new Set([...collectChildren(boys), ...collectChildren(girls)])];
  }

  //
  // -----------------------------------------
  // Normal Parent Category
  // -----------------------------------------
  //
  const parent = categories.find(
    (category) =>
      category.parent === 0 && category.slug.toLowerCase() === value,
  );

  if (!parent) {
    return [];
  }

  const children = categories.filter(
    (category) => category.parent === parent.id,
  );

  return [parent.id, ...children.map((child) => child.id)];
}
