// app/fun/removeProductTag.js

/**
 * Remove a tag from products
 *
 * @param {object} admin - Shopify Admin API client
 * @param {Array} products - Array of products (id, tags, status required)
 * @param {string} tag - Tag to remove
 * @param {number} batchSize
 * @param {"ACTIVE"|"DRAFT"|"ALL"} filterStatus
 * @returns {Array} Updated products
 */

export async function removeProductTag(
  admin,
  products,
  tag,
  batchSize,
  filterStatus
) {
  batchSize = Number(batchSize) || 25;
  const updatedProducts = [];

  if (!Array.isArray(products) || products.length === 0 || !tag) {
    return updatedProducts;
  }

  const toGid = (id) =>
    id.toString().startsWith("gid://")
      ? id
      : `gid://shopify/Product/${id}`;

  // ✅ Filter by status
  const filteredProducts =
    filterStatus === "ALL"
      ? products
      : products.filter(p => p.status === filterStatus);

  for (let i = 0; i < filteredProducts.length; i += batchSize) {
    const batch = filteredProducts.slice(i, i + batchSize);

    for (const product of batch) {
      // Normalize tags
      const currentTags = Array.isArray(product.tags)
        ? [...product.tags]
        : typeof product.tags === "string"
          ? product.tags.split(",").map(t => t.trim()).filter(Boolean)
          : [];

      // Skip if tag does not exist
      if (!currentTags.includes(tag)) {
        continue;
      }

      const updatedTags = currentTags.filter(t => t !== tag);
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
                tags: updatedTags,
              },
            },
          }
        );

        const result =
          response?.body?.data?.productUpdate ??
          response?.data?.productUpdate;

        if (result?.userErrors?.length) {
          console.warn(
            "Tag removal error:",
            result.userErrors.map(e => e.message)
          );
          continue;
        }

        updatedProducts.push({
          ...product,
          tags: updatedTags,
        });
      } catch (error) {
        console.error(
          "Error removing tag:",
          productGid,
          error?.message || error
        );
      }

      // Rate limit safety
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  return updatedProducts;
}
