// app/fun/updateProducts.js

/**
 * Update products: add tag and/or update status
 *
 * @param {object} admin - Shopify Admin API client
 * @param {Array} products - Array of products (id, tags, status required)
 * @param {string} tag - Tag to add
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
  replaceTag = null
) {

  console.log(tag, " ", updatedStatus, " ", filterStatus)
  batchSize = Number(batchSize) || 25;
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

  for (let i = 0; i < filteredProducts.length; i += batchSize) {
    const batch = filteredProducts.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;

    // console.log(`Processing batch ${batchIndex}: ${batch.length} products`);

    for (const product of batch) {
      // Normalize tags
      const currentTags = Array.isArray(product.tags)
        ? [...product.tags]
        : typeof product.tags === "string"
          ? product.tags.split(",").map(t => t.trim()).filter(Boolean)
          : [];

      // If replacing a tag, remove the old tag and add the new one
      if (replaceTag) {
        const oldTagIndex = currentTags.indexOf(replaceTag);
        if (oldTagIndex !== -1) {
          currentTags.splice(oldTagIndex, 1);
        }
        // Add new tag if it doesn't exist
        if (!currentTags.includes(tag) && tag) {
          currentTags.push(tag);
        }
      } else {
        // If tag already exists and no status update is needed, skip
        if (currentTags.includes(tag) && !updatedStatus) {
          continue;
        }

        // Add tag if it doesn't exist
        if (!currentTags.includes(tag) && tag) {
          currentTags.push(tag);
        }
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
          continue;
        }

        updatedProducts.push({
          ...product,
          tags: currentTags,
          status: updatedStatus ?? product.status,
        });
      } catch (error) {
        console.error(
          "Error updating product:",
          productGid,
          error?.message || error
        );
      }

      // Rate-limit safety
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return updatedProducts;
}
