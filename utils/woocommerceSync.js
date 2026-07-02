import { wc } from "../config/db.js";

export const getOrCreateCustomer = async ({ email, name }) => {
  // 1. Try email lookup
  let response = await wc.get("/customers", {
    params: {
      email,
    },
  });

  if (response.data.length > 0) {
    return response.data[0];
  }

  // 2. Try general search
  response = await wc.get("/customers", {
    params: {
      search: email,
    },
  });

  if (response.data.length > 0) {
    return response.data[0];
  }

  // 3. Create only if really missing

  try {
    const created = await wc.post("/customers", {
      email,
      username: email,
      first_name: name || "",
    });

    return created.data;
  } catch (error) {
    // WooCommerce says email exists
    if (error.response?.data?.code === "registration-error-email-exists") {
      // Fetch by username
      const retry = await wc.get("/customers", {
        params: {
          search: email,
        },
      });

      if (retry.data.length) {
        return retry.data[0];
      }
    }

    throw error;
  }
};

export const syncWooCustomer = async ({ email, name }) => {
  // 1. Find existing Woo customer

  const existing = await wc.get("/customers", {
    params: {
      email,
    },
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // 2. Try search fallback

  const searched = await wc.get("/customers", {
    params: {
      search: email,
    },
  });

  if (searched.data.length > 0) {
    return searched.data[0];
  }

  // 3. Create customer

  try {
    const created = await wc.post("/customers", {
      email,

      username: email,

      first_name: name || "",
    });

    return created.data;
  } catch (error) {
    if (error.response?.data?.code === "registration-error-email-exists") {
      throw new Error(
        "WordPress user exists but WooCommerce customer sync failed",
      );
    }

    throw error;
  }
};
