/**
 * Update datetime field of a metaobject
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} metaobjectGid - Metaobject GID
 */
export async function updateNextRunMetaobject(admin, metaobjectGid) {
  const now = new Date().toISOString();

  try {
    const response = await admin.graphql(
      `#graphql
      mutation updateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: metaobjectGid,
          metaobject: {
            fields: [
              {
                key: "datetime",
                value: now,
              },
            ],
          },
        },
      }
    );

    const result =
      response?.body?.data?.metaobjectUpdate ||
      response?.data?.metaobjectUpdate;

    if (result?.userErrors?.length) {
      console.error(
        "[METAOBJECT ERRORS]",
        result.userErrors.map((e) => e.message)
      );
      return false;
    }

    console.log(`[METAOBJECT] Updated datetime → `, now);
    return true;
  } catch (err) {
    console.error("[METAOBJECT UPDATE ERROR]", err?.message || err);
    return false;
  }
}
