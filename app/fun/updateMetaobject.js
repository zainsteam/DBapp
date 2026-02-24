/**
 * Update datetime field of a metaobject
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} metaobjectGid - Metaobject GID
 */
export async function updateNextRunMetaobject(admin, metaobjectGid) {
  // Base on current UTC time, convert to PKT (UTC+5), then add 3 hours for "next run"
  const nowDate = new Date();
  const utcMs = nowDate.getTime() + nowDate.getTimezoneOffset() * 60 * 1000;
  const nextRunPktDate = new Date(utcMs + (5 + 3) * 60 * 60 * 1000); // PKT + 3 hours

  // Format: YYYY/M/D H:m:s (e.g., 2024/12/4 0:0:00) in PKT
  const year = nextRunPktDate.getFullYear();
  const month = nextRunPktDate.getMonth() + 1; // 1-based
  const day = nextRunPktDate.getDate();
  const hours = nextRunPktDate.getHours();
  const minutes = nextRunPktDate.getMinutes();
  const seconds = nextRunPktDate.getSeconds();

  const formattedNow = `${year}/${month}/${day} ${hours}:${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;

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
                value: formattedNow,
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

    console.log(`[METAOBJECT] Updated datetime → `, formattedNow);
    return true;
  } catch (err) {
    console.error("[METAOBJECT UPDATE ERROR]", err?.message || err);
    return false;
  }
}
