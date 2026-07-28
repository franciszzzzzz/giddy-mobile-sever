import Fuse from "fuse.js";

/**
 * Resolves the closest matching value from a collection.
 *
 * Example:
 *
 * values = ["Lattafa", "Armaf", "Afnan"]
 *
 * input = "latafa"
 *
 * returns
 *
 * "Lattafa"
 */

export default function resolveFuzzyValue(
  values = [],
  input = "",
  threshold = 0.35,
) {
  if (!input || !values.length) {
    return null;
  }

  const items = values.filter(Boolean).map((value) => ({
    original: value,
    search: value.toLowerCase(),
  }));

  const fuse = new Fuse(items, {
    keys: ["search"],
    threshold,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const result = fuse.search(input.toLowerCase().trim());

  if (!result.length) {
    return null;
  }

  return result[0].item.original;
}
