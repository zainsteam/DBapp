/**
 * Update datetime field of a metaobject
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} metaobjectGid - Metaobject GID
 */
export async function updateNextRunMetaobject(admin, metaobjectGid) {
  // Use current time plus 3 hours
  const nowDate = new Date(Date.now() + 3 * 60 * 60 * 1000);

  // Format: YYYY/M/D H:m:s (e.g., 2024/12/4 0:0:00)
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth() + 1; // 1-based
  const day = nowDate.getDate();
  const hours = nowDate.getHours();
  const minutes = nowDate.getMinutes();
  const seconds = nowDate.getSeconds();

  const now = `${year}/${month}/${day} ${hours}:${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;

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
