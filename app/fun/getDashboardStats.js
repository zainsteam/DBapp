const ACTIVE_LIMIT = Number(process.env.ROTATION_ACTIVE_LIMIT || 3000);
const METAOBJECT_GID = "gid://shopify/Metaobject/199390101750";

async function getGraphqlData(response) {
  if (response && typeof response.json === "function") {
    const json = await response.json();
    return json?.data;
  }
  return response?.body?.data ?? response?.data;
}

export async function getDashboardStats(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query dashboardStats(
        $metaobjectId: ID!
        $qActiveAll: String!
        $qActiveNew: String!
        $qActiveUsed: String!
        $qActiveSlightly: String!
        $qDraftAll: String!
        $qDraftNew: String!
        $qDraftUsed: String!
        $qDraftSlightly: String!
      ) {
        metaobject(id: $metaobjectId) {
          fields {
            key
            value
          }
        }

        activeAll: productsCount(query: $qActiveAll) {
          count
        }
        activeNew: productsCount(query: $qActiveNew) {
          count
        }
        activeUsed: productsCount(query: $qActiveUsed) {
          count
        }
        activeSlightly: productsCount(query: $qActiveSlightly) {
          count
        }

        draftAll: productsCount(query: $qDraftAll) {
          count
        }
        draftNew: productsCount(query: $qDraftNew) {
          count
        }
        draftUsed: productsCount(query: $qDraftUsed) {
          count
        }
        draftSlightly: productsCount(query: $qDraftSlightly) {
          count
        }
      }`,
      {
        variables: {
          metaobjectId: METAOBJECT_GID,
          qActiveAll: "status:ACTIVE",
          qActiveNew: "status:ACTIVE tag:new",
          qActiveUsed: "status:ACTIVE tag:used",
          qActiveSlightly: "status:ACTIVE tag:slightly-used",
          qDraftAll: "status:DRAFT",
          qDraftNew: "status:DRAFT tag:new",
          qDraftUsed: "status:DRAFT tag:used",
          qDraftSlightly: "status:DRAFT tag:slightly-used",
        },
      }
    );

    const data = await getGraphqlData(response);

    const fields = data?.metaobject?.fields || [];
    const datetimeField = fields.find((f) => f.key === "datetime");
    const nextRunAt = datetimeField?.value || null;

    const activeTotal = data?.activeAll?.count ?? 0;
    const activeNew = data?.activeNew?.count ?? 0;
    const activeUsed = data?.activeUsed?.count ?? 0;
    const activeSlightly = data?.activeSlightly?.count ?? 0;

    const draftTotal = data?.draftAll?.count ?? 0;
    const draftNew = data?.draftNew?.count ?? 0;
    const draftUsed = data?.draftUsed?.count ?? 0;
    const draftSlightly = data?.draftSlightly?.count ?? 0;

    return {
      nextRunAt,
      active: {
        total: activeTotal,
        byCondition: {
          new: activeNew,
          used: activeUsed,
          slightlyUsed: activeSlightly,
        },
      },
      drafts: {
        total: draftTotal,
        byCondition: {
          new: draftNew,
          used: draftUsed,
          slightlyUsed: draftSlightly,
        },
      },
      capacity: {
        activeLimit: ACTIVE_LIMIT,
        currentActive: activeTotal,
      },
    };
  } catch (error) {
    console.error("[DASHBOARD STATS ERROR]", error?.message || error);
    return {
      nextRunAt: null,
      active: { total: 0, byCondition: { new: 0, used: 0, slightlyUsed: 0 } },
      drafts: { total: 0, byCondition: { new: 0, used: 0, slightlyUsed: 0 } },
      capacity: { activeLimit: ACTIVE_LIMIT, currentActive: 0 },
    };
  }
}

