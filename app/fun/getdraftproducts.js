export async function getDraftProducts(admin, { first = 10, after, before }, status) {
  const query = `status:${status}`;
  console.log("getting draft products started", query)

  const response = await admin.graphql(
    `
    query getDraftProducts(
      $first: Int
      $after: String
      $before: String
      $query:String
    ) {
      products(
        first: $first
        after: $after
        before: $before
        query: $query
      ) {
        edges {
          cursor
          node {
            id
            title
            status
            tags
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
      productsCount(query: $query) {
        count
      }
    }
  `,
    {
      variables: { first, after, before, query },
    }
  );

  const json = await response.json();
  const edges = json?.data?.products?.edges ?? [];
  const pageInfo = json?.data?.products?.pageInfo ?? {};
  const totalCount = json?.data?.productsCount?.count ?? 0;

  console.log("getting draft products edded")

  return { edges, pageInfo, totalCount };
}
