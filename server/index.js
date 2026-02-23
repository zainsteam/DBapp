var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, useFetcher } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import schedule from "node-schedule";
import PQueue from "p-queue";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.October25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 1e4;
async function handleRequest(request, responseStatusCode, responseHeaders, reactRouterContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: reactRouterContext, url: request.url }),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://cdn.shopify.com/"
      }), /* @__PURE__ */ jsx("link", {
        rel: "stylesheet",
        href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({
  request
}) => {
  const {
    payload,
    session,
    topic,
    shop
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const action$2 = async ({
  request
}) => {
  const {
    shop,
    session,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({
      where: {
        shop
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$5 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$1 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const route$1 = UNSAFE_withComponentProps(function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const {
    errors
  } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, {
    embedded: false,
    children: /* @__PURE__ */ jsx("s-page", {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs("s-section", {
          heading: "Log in",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            name: "shop",
            label: "Shop domain",
            details: "example.myshopify.com",
            value: shop,
            onChange: (e) => setShop(e.currentTarget.value),
            autocomplete: "on",
            error: errors.shop
          }), /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            children: "Log in"
          })]
        })
      })
    })
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: route$1,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$4 = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return {
    showForm: Boolean(login)
  };
};
const route = UNSAFE_withComponentProps(function App2() {
  const {
    showForm
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: styles.index,
    children: /* @__PURE__ */ jsxs("div", {
      className: styles.content,
      children: [/* @__PURE__ */ jsx("h1", {
        className: styles.heading,
        children: "A short heading about [your app]"
      }), /* @__PURE__ */ jsx("p", {
        className: styles.text,
        children: "A tagline about [your app] that describes your value proposition."
      }), showForm && /* @__PURE__ */ jsxs(Form, {
        className: styles.form,
        method: "post",
        action: "/auth/login",
        children: [/* @__PURE__ */ jsxs("label", {
          className: styles.label,
          children: [/* @__PURE__ */ jsx("span", {
            children: "Shop domain"
          }), /* @__PURE__ */ jsx("input", {
            className: styles.input,
            type: "text",
            name: "shop"
          }), /* @__PURE__ */ jsx("span", {
            children: "e.g: my-shop-domain.myshopify.com"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: styles.button,
          type: "submit",
          children: "Log in"
        })]
      }), /* @__PURE__ */ jsxs("ul", {
        className: styles.list,
        children: [/* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        })]
      })]
    })
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$3 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$3,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({
  request
}) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsx("s-app-nav", {
      children: /* @__PURE__ */ jsx("s-link", {
        href: "/app/additional",
        children: "Products"
      })
    }), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  return boundary.error(useRouteError());
});
const headers$2 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: app,
  headers: headers$2,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
async function getDraftProducts(admin, { first = 10, after, before }, status) {
  var _a2, _b, _c, _d, _e, _f;
  const query = `status:${status}`;
  console.log("getting draft products started", query);
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
      variables: { first, after, before, query }
    }
  );
  const json = await response.json();
  const edges = ((_b = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.products) == null ? void 0 : _b.edges) ?? [];
  const pageInfo = ((_d = (_c = json == null ? void 0 : json.data) == null ? void 0 : _c.products) == null ? void 0 : _d.pageInfo) ?? {};
  const totalCount = ((_f = (_e = json == null ? void 0 : json.data) == null ? void 0 : _e.productsCount) == null ? void 0 : _f.count) ?? 0;
  console.log("getting draft products edded");
  return { edges, pageInfo, totalCount };
}
const loader$1 = async ({
  request
}) => {
  const {
    admin
  } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  url.searchParams.get("before");
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
      totalCount: count
    } = await getDraftProducts(admin, {
      first: 100,
      after: cursor
    }, status);
    edges.push(...fetchedEdges);
    totalFetched += fetchedEdges.length;
    totalCount = count;
    pageInfo = fetchedPageInfo;
    if (!fetchedPageInfo.hasNextPage || totalFetched >= MAX_PRODUCTS) break;
    cursor = fetchedPageInfo.endCursor;
  }
  if (edges.length > MAX_PRODUCTS) {
    edges = edges.slice(0, MAX_PRODUCTS);
  }
  const products = edges.map((e) => e.node);
  const updatedProducts = await products;
  return {
    products: updatedProducts,
    pageInfo,
    totalCount
  };
};
const app_additional = UNSAFE_withComponentProps(function ProductsPage() {
  var _a2, _b, _c, _d, _e;
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify2 = useAppBridge();
  const products = ((_a2 = fetcher.data) == null ? void 0 : _a2.products) ?? loaderData.products;
  const pageInfo = ((_b = fetcher.data) == null ? void 0 : _b.pageInfo) ?? loaderData.pageInfo;
  const activeProducts = ((_c = fetcher.data) == null ? void 0 : _c.products) ?? products;
  const totalCount = ((_d = fetcher.data) == null ? void 0 : _d.totalCount) ?? loaderData.totalCount;
  ((_e = fetcher.data) == null ? void 0 : _e.pageInfo) ?? pageInfo;
  useEffect(() => {
    if (products.length > 0) {
      shopify2.toast.show(`Loaded ${products.length} products`);
    }
  }, [products.length, shopify2]);
  function loadNextPage() {
    fetcher.load(`?after=${pageInfo.endCursor}`);
  }
  function loadPreviousPage() {
    fetcher.load(`?before=${pageInfo.startCursor}`);
  }
  function generateProduct() {
    console.log("Generating a product");
    shopify2.toast.show(`Loaded ${products.length} products`);
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [fetcher.state === "loading" && /* @__PURE__ */ jsx("s-spinner", {
      accessibilityLabel: "Loading products"
    }), /* @__PURE__ */ jsxs("s-page", {
      heading: `Shopify Products (${totalCount})`,
      slot: "primary-action",
      padding: "none",
      inlineSize: "large",
      children: [/* @__PURE__ */ jsx("s-button", {
        slot: "primary-action",
        onClick: generateProduct,
        children: "Sync Products"
      }), /* @__PURE__ */ jsx("s-section", {
        padding: "none",
        children: products.length === 0 ? /* @__PURE__ */ jsx("s-paragraph", {
          children: "No products found."
        }) : /* @__PURE__ */ jsx("s-box", {
          padding: "none",
          background: "subdued",
          style: {
            overflowX: "auto",
            width: "100%",
            display: "block",
            blockSize: "auto"
          },
          children: /* @__PURE__ */ jsxs("s-table", {
            paginate: true,
            hasNextPage: pageInfo.hasNextPage,
            hasPreviousPage: pageInfo.hasPreviousPage,
            onNextPage: loadNextPage,
            onPreviousPage: loadPreviousPage,
            disabled: fetcher.state !== "idle",
            children: [/* @__PURE__ */ jsx("s-grid", {
              slot: "filters",
              gap: "small-200",
              gridTemplateColumns: "1fr auto",
              children: /* @__PURE__ */ jsx("s-text-field", {
                label: "Search puzzles",
                labelAccessibilityVisibility: "exclusive",
                icon: "search",
                placeholder: "Searching all puzzles"
              })
            }), /* @__PURE__ */ jsxs("s-table-header-row", {
              children: [/* @__PURE__ */ jsx("s-table-header", {
                listSlot: "primary",
                children: "Product"
              }), /* @__PURE__ */ jsx("s-table-header", {
                listSlot: "inline",
                children: "Status"
              }), /* @__PURE__ */ jsx("s-table-header", {
                listSlot: "inline",
                children: "Created At"
              }), /* @__PURE__ */ jsx("s-table-header", {
                listSlot: "inline",
                children: "Sync Status"
              })]
            }), /* @__PURE__ */ jsx("s-table-body", {
              children: activeProducts.map((product) => /* @__PURE__ */ jsxs("s-table-row", {
                children: [/* @__PURE__ */ jsx("s-table-cell", {
                  children: product.title
                }), /* @__PURE__ */ jsx("s-table-cell", {
                  children: /* @__PURE__ */ jsx("s-badge", {
                    color: "base",
                    tone: product.status == "ACTIVE" ? "success" : product.status == "DRAFT" ? "caution" : "neutral",
                    children: product.status
                  })
                }), /* @__PURE__ */ jsx("s-table-cell", {
                  children: new Date(product.createdAt).toDateString()
                }), /* @__PURE__ */ jsx("s-table-cell", {
                  children: product.status == "ACTIVE" ? /* @__PURE__ */ jsx("s-badge", {
                    tone: "success",
                    icon: "check",
                    accessibilityLabel: "Synced",
                    children: "Synced"
                  }) : /* @__PURE__ */ jsx("s-button", {
                    tone: "critical",
                    icon: "arrows-out-horizontal",
                    accessibilityLabel: "Not Sync",
                    children: "Sync Now"
                  })
                })]
              }, product.id))
            })]
          })
        })
      })]
    })]
  });
});
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_additional,
  headers: headers$1,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
async function updateNextRunMetaobject(admin, metaobjectGid) {
  var _a2, _b, _c, _d;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
                value: now
              }
            ]
          }
        }
      }
    );
    const result = ((_b = (_a2 = response == null ? void 0 : response.body) == null ? void 0 : _a2.data) == null ? void 0 : _b.metaobjectUpdate) || ((_c = response == null ? void 0 : response.data) == null ? void 0 : _c.metaobjectUpdate);
    if ((_d = result == null ? void 0 : result.userErrors) == null ? void 0 : _d.length) {
      console.error(
        "[METAOBJECT ERRORS]",
        result.userErrors.map((e) => e.message)
      );
      return false;
    }
    console.log(`[METAOBJECT] Updated datetime → `, now);
    return true;
  } catch (err) {
    console.error("[METAOBJECT UPDATE ERROR]", (err == null ? void 0 : err.message) || err);
    return false;
  }
}
const METAOBJECT_GID = "gid://shopify/Metaobject/247407607989";
const ACTIVE_LIMIT = 100;
const BATCH_SIZE = 50;
const CONCURRENCY = 4;
const DELAY_BETWEEN_BATCHES = 500;
async function getAllProducts(admin, afterCursor = null) {
  let products = [];
  let cursor = afterCursor;
  let hasNextPage = true;
  while (hasNextPage) {
    const response = await admin.graphql(
      `
        query ($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                status
                title
                metafield(namespace: "custom", key: "assign") {
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      { variables: { first: 250, after: cursor } }
    );
    const json = await response.json();
    if (json.errors) {
      console.error("[GRAPHQL ERRORS in getAllProducts]:", json.errors);
      break;
    }
    const { edges, pageInfo } = json.data.products;
    products.push(...edges.map((e) => {
      var _a2;
      const node = e.node;
      const assignValue = ((_a2 = node.metafield) == null ? void 0 : _a2.value) ? parseInt(node.metafield.value, 10) || 0 : 0;
      return {
        ...node,
        assignValue
        // Store the current metafield value
      };
    }));
    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;
    await new Promise((r) => setTimeout(r, 100));
  }
  return { products, lastCursor: cursor };
}
async function updateProduct(admin, product, assignValue, retries = 3) {
  var _a2, _b;
  try {
    const input2 = { ...product };
    if (product.status === "ACTIVE") {
      const currentValue = assignValue ?? 0;
      const newValue = currentValue === 0 ? 1 : currentValue + 1;
      input2.metafields = [{
        namespace: "custom",
        key: "assign",
        type: "number_integer",
        value: String(newValue)
      }];
    }
    const response = await admin.graphql(
      `#graphql
      mutation ($input: ProductUpdateInput!) {
        productUpdate(product: $input) {
          product { id status }
          userErrors { field message }
        }
      }`,
      { variables: { input: input2 } }
    );
    const json = await response.json();
    if (json.errors) {
      console.error("[GRAPHQL ERRORS]", json.errors);
      return null;
    }
    const result = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.productUpdate;
    if ((_b = result == null ? void 0 : result.userErrors) == null ? void 0 : _b.length) {
      console.error("[PRODUCT UPDATE ERRORS]", result.userErrors);
    }
    return result;
  } catch (error) {
    if (retries > 0 && error.message.includes("429")) {
      await new Promise((r) => setTimeout(r, 2e3));
      return updateProduct(admin, product, assignValue, retries - 1);
    }
    console.error(`[PRODUCT UPDATE ERROR] ${product.id}:`, (error == null ? void 0 : error.message) || error);
    return null;
  }
}
async function batchUpdateProducts(admin, updates) {
  const queue = new PQueue({ concurrency: CONCURRENCY });
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((p) => queue.add(() => updateProduct(admin, p.product, p.assignValue))));
    console.log(`[JOB] Updated batch ${i + 1}-${i + batch.length}`);
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }
}
function startNextRunJob1(admin) {
  if (global.rotationJobStarted) return;
  global.rotationJobStarted = true;
  console.log("[JOB] Product rotation scheduler started");
  schedule.scheduleJob("0 */2 * * * *", async () => {
    if (global.rotationJobRunning) {
      console.log("[JOB] Previous run still active, skipping.");
      return;
    }
    global.rotationJobRunning = true;
    try {
      console.log("[JOB] Rotation started", (/* @__PURE__ */ new Date()).toISOString());
      const { products: allProducts } = await getAllProducts(admin);
      const activeProducts = allProducts.filter((p) => p.status === "ACTIVE");
      const draftProducts = allProducts.filter((p) => p.status === "DRAFT");
      console.log(`[JOB] ACTIVE: ${activeProducts.length}, DRAFT: ${draftProducts.length}`);
      const deactivatePayload = activeProducts.map((p) => ({
        product: { id: p.id, status: "DRAFT" },
        assignValue: p.assignValue || 0
      }));
      const activatePayload = draftProducts.slice(0, ACTIVE_LIMIT).map((p) => ({
        product: { id: p.id, status: "ACTIVE" },
        assignValue: p.assignValue || 0
      }));
      const combinedUpdates = [...deactivatePayload, ...activatePayload];
      if (combinedUpdates.length > 0) {
        console.log(`[JOB] Updating ${combinedUpdates.length} products...`);
        await batchUpdateProducts(admin, combinedUpdates);
      }
      await updateNextRunMetaobject(admin, METAOBJECT_GID);
      console.log(`[JOB] Completed successfully — ACTIVE=${activatePayload.length}`);
    } catch (error) {
      console.error("[JOB] Rotation failed:", error);
    } finally {
      global.rotationJobRunning = false;
    }
  });
}
const loader = async ({
  request
}) => {
  const {
    admin
  } = await authenticate.admin(request);
  startNextRunJob1(admin);
  return null;
};
const action = async ({
  request
}) => {
  const {
    admin
  } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][Math.floor(Math.random() * 4)];
  const response = await admin.graphql(`#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`, {
    variables: {
      product: {
        title: `${color} Snowboard`
      }
    }
  });
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(`#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`, {
    variables: {
      productId: product.id,
      variants: [{
        id: variantId,
        price: "100.00"
      }]
    }
  });
  const variantResponseJson = await variantResponse.json();
  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants
  };
};
const app__index = UNSAFE_withComponentProps(function Index() {
  var _a2, _b, _c, _d;
  const fetcher = useFetcher();
  const shopify2 = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  useEffect(() => {
    var _a3, _b2;
    if ((_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id) {
      shopify2.toast.show("Product created");
    }
  }, [(_b = (_a2 = fetcher.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.id, shopify2]);
  const generateProduct = () => fetcher.submit({}, {
    method: "POST"
  });
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Shopify app template",
    children: [/* @__PURE__ */ jsx("s-button", {
      slot: "primary-action",
      onClick: generateProduct,
      children: "Generate a product"
    }), /* @__PURE__ */ jsx("s-section", {
      heading: "Congrats on creating a new Shopify app 🎉",
      children: /* @__PURE__ */ jsxs("s-paragraph", {
        children: ["This embedded app template uses", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/tools/app-bridge",
          target: "_blank",
          children: "App Bridge"
        }), " ", "interface examples like an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "/app/additional",
          children: "additional page in the app nav"
        }), ", as well as an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "Admin GraphQL"
        }), " ", "mutation demo, to provide a starting point for app development."]
      })
    }), /* @__PURE__ */ jsxs("s-section", {
      heading: "Get started with products",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: ["Generate a product with GraphQL and get the JSON output for that product. Learn more about the", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate",
          target: "_blank",
          children: "productCreate"
        }), " ", "mutation in our API references."]
      }), /* @__PURE__ */ jsxs("s-stack", {
        direction: "inline",
        gap: "base",
        children: [/* @__PURE__ */ jsx("s-button", {
          onClick: generateProduct,
          ...isLoading ? {
            loading: true
          } : {},
          children: "Generate a product"
        }), ((_c = fetcher.data) == null ? void 0 : _c.product) && /* @__PURE__ */ jsx("s-button", {
          onClick: () => {
            var _a3, _b2, _c2, _d2;
            (_d2 = (_c2 = shopify2.intents).invoke) == null ? void 0 : _d2.call(_c2, "edit:shopify/Product", {
              value: (_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id
            });
          },
          target: "_blank",
          variant: "tertiary",
          children: "Edit product"
        })]
      }), ((_d = fetcher.data) == null ? void 0 : _d.product) && /* @__PURE__ */ jsx("s-section", {
        heading: "productCreate mutation",
        children: /* @__PURE__ */ jsxs("s-stack", {
          direction: "block",
          gap: "base",
          children: [/* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.product, null, 2)
              })
            })
          }), /* @__PURE__ */ jsx("s-heading", {
            children: "productVariantsBulkUpdate mutation"
          }), /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.variant, null, 2)
              })
            })
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("s-section", {
      slot: "aside",
      heading: "App template specs",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Framework: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://reactrouter.com/",
          target: "_blank",
          children: "React Router"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Interface: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/app-home/using-polaris-components",
          target: "_blank",
          children: "Polaris web components"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "API: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "GraphQL"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Database: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://www.prisma.io/",
          target: "_blank",
          children: "Prisma"
        })]
      })]
    }), /* @__PURE__ */ jsx("s-section", {
      slot: "aside",
      heading: "Next steps",
      children: /* @__PURE__ */ jsxs("s-unordered-list", {
        children: [/* @__PURE__ */ jsxs("s-list-item", {
          children: ["Build an", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/getting-started/build-app-example",
            target: "_blank",
            children: "example app"
          })]
        }), /* @__PURE__ */ jsxs("s-list-item", {
          children: ["Explore Shopify's API with", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/tools/graphiql-admin-api",
            target: "_blank",
            children: "GraphiQL"
          })]
        })]
      })
    })]
  });
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app__index,
  headers,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BXkWrp0c.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/root-CDgFGR37.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/route-BrHpbGQa.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js", "/assets/AppProxyProvider-BGwpLmAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/route-DhP34_St.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js"], "css": ["/assets/route-Xpdx9QZl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/app-DUQ50Jk6.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js", "/assets/AppProxyProvider-BGwpLmAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/app.additional-Br1NZCT2.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/app._index-BrMXoHIq.js", "imports": ["/assets/chunk-EPOLDU6W-DaavK2Ov.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-b6c597b8.js", "version": "b6c597b8", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route8
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
