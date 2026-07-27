import Fuse from "fuse.js";

export default function fuzzyMatch(dictionary, text, threshold = 0.35) {
  const words = dictionary.map((word) => ({
    value: word.toLowerCase(),
  }));

  const fuse = new Fuse(words, {
    keys: ["value"],
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const result = fuse.search(token);

    if (result.length) {
      return true;
    }
  }

  return false;
}
