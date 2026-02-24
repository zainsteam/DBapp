/**
 * Update (create or update) a product metafield
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} productGid - Product GID (gid://shopify/Product/...)
 * @param {object} metafield
 * @param {string} metafield.namespace
 * @param {string} metafield.key
 * @param {string} metafield.type - Shopify metafield type (e.g. date_time)
 * @param {string} metafield.value
 */
export async function updateProductMetafield(
  admin,
  productGid,
  { namespace, key, type, value }
) {
  return await updateProductMetafields(admin, [
    {
      ownerId: productGid,
      namespace,
      key,
      type,
      value,
    },
  ]);
}

/**
 * Bulk set metafields across one/many products.
 *
 * @param {object} admin - Shopify Admin API client
 * @param {Array<{ownerId: string, namespace: string, key: string, type: string, value: string}>} metafields
 * @returns {Promise<boolean>}
 */
export async function updateProductMetafields(admin, metafields) {
  try {
    if (!Array.isArray(metafields) || metafields.length === 0) {
      return true;
    }

    const response = await admin.graphql(
      `#graphql
      mutation updateProductMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
            type
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields,
        },
      }
    );

    const result =
      response?.body?.data?.metafieldsSet ||
      response?.data?.metafieldsSet;

    if (result?.userErrors?.length) {
      console.error(
        "[PRODUCT METAFIELD ERRORS]",
        result.userErrors.map((e) => e.message)
      );
      return false;
    }

    console.log(`[PRODUCT METAFIELD] Updated ${metafields.length} metafield(s)`);
    return true;
  } catch (err) {
    console.error("[PRODUCT METAFIELD UPDATE ERROR]", err?.message || err);
    return false;
  }
}
