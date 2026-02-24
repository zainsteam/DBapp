// app/fun/updateProducts.js

/**
 * Update products: add tag and/or update status
 *
 * @param {object} admin - Shopify Admin API client
 * @param {Array} products - Array of products (id, tags, status required)
 * @param {string|string[]} tag - Tag(s) to add (single tag or array)
 * @param {"ACTIVE"|"DRAFT"} updatedStatus - Optional new status
 * @param {number} batchSize
 * @param {"ACTIVE"|"DRAFT"|"ALL"} filterStatus - Which products to process
 * @param {string} replaceTag - Optional tag to replace (remove old tag, add new tag)
 * @returns {Array} Updated products
 */

export async function assignNextProductsTag(
  admin,
  products,
  tag,
  updatedStatus,
  batchSize = 25,
  filterStatus,
  replaceTag = null,
  concurrency = 3,
  throttleMs = 100
) {

  const tagsToAdd = Array.isArray(tag) ? tag.filter(Boolean) : [tag].filter(Boolean);
  console.log(tagsToAdd.length ? tagsToAdd.join(", ") : tag, " ", updatedStatus, " ", filterStatus);
  batchSize = Number(batchSize) || 25;
  concurrency = Math.max(1, Number(concurrency) || 1);
  throttleMs = Math.max(0, Number(throttleMs) || 0);
  const updatedProducts = [];

  if (!Array.isArray(products) || products.length === 0) {
    return updatedProducts;
  }

  // Convert numeric ID to Shopify GraphQL GID
  const toGid = (id) =>
    id.toString().startsWith("gid://")
      ? id
      : `gid://shopify/Product/${id}`;

  // ✅ Filter products by status (IMPORTANT)
  const filteredProducts =
    filterStatus === "ALL"
      ? products
      : products.filter(
        (p) => p.status === filterStatus
      );

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const tagsToArray = (tags) =>
    Array.isArray(tags)
      ? tags.filter(Boolean)
      : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

  const sameTagSet = (a, b) => {
    const aSet = new Set(a);
    const bSet = new Set(b);
    if (aSet.size !== bSet.size) return false;
    for (const v of aSet) if (!bSet.has(v)) return false;
    return true;
  };

  async function updateSingleProduct(product) {
    const originalTags = tagsToArray(product.tags);
    const currentTags = [...originalTags];

    // If replacing a tag, remove the old tag and add the new one(s)
    if (replaceTag) {
      const oldTagIndex = currentTags.indexOf(replaceTag);
      if (oldTagIndex !== -1) {
        currentTags.splice(oldTagIndex, 1);
      }
      for (const t of tagsToAdd) {
        if (!currentTags.includes(t)) currentTags.push(t);
      }
    } else {
      // If all tags already exist and no status update, skip
      const allPresent = tagsToAdd.length > 0 && tagsToAdd.every((t) => currentTags.includes(t));
      if (allPresent && !updatedStatus) {
        return null;
      }
      for (const t of tagsToAdd) {
        if (!currentTags.includes(t)) currentTags.push(t);
      }
    }

    const tagsChanged = !sameTagSet(originalTags, currentTags);
    const statusChanged = Boolean(updatedStatus) && updatedStatus !== product.status;
    if (!tagsChanged && !statusChanged) {
      return null;
    }

    const productGid = toGid(product.id);

    try {
      const response = await admin.graphql(
        `
          mutation updateProduct($product: ProductUpdateInput!) {
            productUpdate(product: $product) {
              product {
                id
                tags
                status
              }
              userErrors {
                field
                message
              }
            }
          }
          `,
        {
          variables: {
            product: {
              id: productGid,
              tags: currentTags,
              ...(updatedStatus ? { status: updatedStatus } : {}),
            },
          },
        }
      );

      const result =
        response?.body?.data?.productUpdate ??
        response?.data?.productUpdate;

      if (result?.userErrors?.length) {
        console.warn(
          "User errors:",
          result.userErrors.map(e => e.message)
        );
        return null;
      }

      return {
        ...product,
        tags: currentTags,
        status: updatedStatus ?? product.status,
      };
    } catch (error) {
      console.error(
        "Error updating product:",
        productGid,
        error?.message || error
      );
      return null;
    }
  }

  for (let i = 0; i < filteredProducts.length; i += batchSize) {
    const batch = filteredProducts.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;

    console.log(`Processing batch ${batchIndex}: ${batch.length} products`);

    for (let j = 0; j < batch.length; j += concurrency) {
      const chunk = batch.slice(j, j + concurrency);
      const results = await Promise.all(chunk.map(updateSingleProduct));
      for (const updated of results) {
        if (updated) updatedProducts.push(updated);
      }

      // Rate-limit safety (applies per concurrent chunk)
      if (throttleMs > 0) await sleep(throttleMs);
    }
  }

  return updatedProducts;
}
