import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";
import { getDraftProducts } from "../fun/getdraftproducts.js";
import { assignNextProductsTag } from "../fun/updatetag.js";
import {removeProductTag } from "../fun/removeProductTag.js"

// Loader fetches data when page loads
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const isBackward = Boolean(before);

  // ✅ max products limit
  const MAX_PRODUCTS = 29;
  let totalFetched = 0;
  let edges = [];
  let pageInfo = {};
  let totalCount = 0;
  let cursor = after || null;
  const status = "DRAFT -tag_not:no-rotation";

  while (totalFetched < MAX_PRODUCTS) {
    const {
      edges: fetchedEdges,
      pageInfo: fetchedPageInfo,
      totalCount: count,
    } = await getDraftProducts(admin, { first: 100, after: cursor }, status);

    edges.push(...fetchedEdges);
    totalFetched += fetchedEdges.length;
    totalCount = count;
    pageInfo = fetchedPageInfo;

    if (!fetchedPageInfo.hasNextPage || totalFetched >= MAX_PRODUCTS) break;

    cursor = fetchedPageInfo.endCursor;
  }

  // Trim if fetched more than 3000
  if (edges.length > MAX_PRODUCTS) {
    edges = edges.slice(0, MAX_PRODUCTS);
  }

  // Update tags
  const products = edges.map((e) => e.node);
  const tag = "nextProducts";
  const updatedstatus = "ACTIVE";
  // const updatedProducts1 = await removeProductTag(
  //   admin,
  //   products,
  //   tag,
  //   25,
  //   status,
  // );
  // const updatedProducts = await assignNextProductsTag(
  //   admin,
  //   products,
  //   tag,
  //   updatedstatus,
  //   25,
  //   status,
  // );
  const updatedProducts = await products;

  return { products: updatedProducts, pageInfo, totalCount };
};

export default function ProductsPage() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();
  const products = fetcher.data?.products ?? loaderData.products;
  const pageInfo = fetcher.data?.pageInfo ?? loaderData.pageInfo;
  const activeProducts = fetcher.data?.products ?? products;
  const totalCount = fetcher.data?.totalCount ?? loaderData.totalCount;
  const activePageInfo = fetcher.data?.pageInfo ?? pageInfo;

  useEffect(() => {
    // optional toast to indicate page loaded
    if (products.length > 0) {
      shopify.toast.show(`Loaded ${products.length} products`);
    }
  }, [products.length, shopify]);

  function loadNextPage() {
    fetcher.load(`?after=${pageInfo.endCursor}`);
  }

  function loadPreviousPage() {
    fetcher.load(`?before=${pageInfo.startCursor}`);
  }

  function generateProduct() {
    console.log("Generating a product");
    shopify.toast.show(`Loaded ${products.length} products`);
  }

  return (
    <>
      {fetcher.state === "loading" && (
        <s-spinner accessibilityLabel="Loading products" />
      )}

      <s-page
        heading={`Shopify Products (${totalCount})`}
        slot="primary-action"
        padding="none"
        inlineSize="large"
      >
        <s-button slot="primary-action" onClick={generateProduct}>
          Sync Products
        </s-button>
        <s-section padding="none">
          {products.length === 0 ? (
            <s-paragraph>No products found.</s-paragraph>
          ) : (
            <s-box
              padding="none"
              background="subdued"
              style={{
                overflowX: "auto",
                width: "100%",
                display: "block",
                blockSize: "auto",
              }}
            >
              <s-table
                paginate
                hasNextPage={pageInfo.hasNextPage}
                hasPreviousPage={pageInfo.hasPreviousPage}
                onNextPage={loadNextPage}
                onPreviousPage={loadPreviousPage}
                disabled={fetcher.state !== "idle"}
              >
                {/* Table headers */}

                <s-grid
                  slot="filters"
                  gap="small-200"
                  gridTemplateColumns="1fr auto"
                >
                  <s-text-field
                    label="Search puzzles"
                    labelAccessibilityVisibility="exclusive"
                    icon="search"
                    placeholder="Searching all puzzles"
                  />
                </s-grid>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Product</s-table-header>
                  <s-table-header listSlot="inline">Status</s-table-header>
                  <s-table-header listSlot="inline">Created At</s-table-header>
                  <s-table-header listSlot="inline">Sync Status</s-table-header>
                </s-table-header-row>

                {/* Table body */}
                <s-table-body>
                  {activeProducts.map((product) => (
                    <s-table-row key={product.id}>
                      <s-table-cell>{product.title}</s-table-cell>
                      <s-table-cell>
                        <s-badge
                          color="base"
                          tone={
                            product.status == "ACTIVE"
                              ? "success"
                              : product.status == "DRAFT"
                                ? "caution"
                                : "neutral"
                          }
                        >
                          {product.status}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        {new Date(product.createdAt).toDateString()}
                      </s-table-cell>

                      <s-table-cell>
                        {product.status == "ACTIVE" ? (
                          <s-badge
                            tone="success"
                            icon="check"
                            accessibilityLabel="Synced"
                          >
                            Synced
                          </s-badge>
                        ) : (
                          <s-button
                            tone="critical"
                            icon="arrows-out-horizontal"
                            accessibilityLabel="Not Sync"
                          >
                            Sync Now
                          </s-button>
                        )}
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            </s-box>
          )}
        </s-section>
      </s-page>
    </>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
