import schedule from "node-schedule";
import PQueue from "p-queue";
import { updateNextRunMetaobject } from "../fun/updateMetaobject.js";

const METAOBJECT_GID = "gid://shopify/Metaobject/199390101750";
const ACTIVE_LIMIT = 3000;
const BATCH_SIZE = 50;       // Smaller batch to avoid throttling
const CONCURRENCY = 3;       // Fewer concurrent requests
const DELAY_BETWEEN_BATCHES = 500; // ms delay between batches

/* -------------------------------
   Fetch all products with cursor
-------------------------------- */
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
    products.push(...edges.map(e => e.node));

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    await new Promise(r => setTimeout(r, 100)); // Rate limit buffer
  }

  return { products, lastCursor: cursor };
}

/* -------------------------------
   Update a single product with retry
-------------------------------- */
async function updateProduct(admin, product, retries = 3) {
  try {
    const response = await admin.graphql(
      `mutation ($input: ProductUpdateInput!) {
        productUpdate(product: $input) {
          product { id status }
          userErrors { field message }
        }
      }`,
      { variables: { input: product } }
    );

    const json = await response.json();

    if (json.errors) {
      console.error("[GRAPHQL ERRORS]", json.errors);
      return null;
    }

    const result = json?.data?.productUpdate;

    if (result?.userErrors?.length) {
      console.error("[PRODUCT UPDATE ERRORS]", result.userErrors);
    }

    return result;
  } catch (error) {
    if (retries > 0 && error.message.includes("429")) {
      await new Promise(r => setTimeout(r, 2000));
      return updateProduct(admin, product, retries - 1);
    }
    console.error(`[PRODUCT UPDATE ERROR] ${product.id}:`, error?.message || error);
    return null;
  }
}

/* -------------------------------
   Batch update with throttling
-------------------------------- */
async function batchUpdateProducts(admin, updates) {
  const queue = new PQueue({ concurrency: CONCURRENCY });

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(p => queue.add(() => updateProduct(admin, p))));
    console.log(`[JOB] Updated batch ${i + 1}-${i + batch.length}`);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }
}

/* -------------------------------
   Scheduler
-------------------------------- */
export function startNextRunJob(admin) {
  if (global.rotationJobStarted) return;
  global.rotationJobStarted = true;

  console.log("[JOB] Product rotation scheduler started");

  // Runs every 2 minutes (adjust as needed)
  schedule.scheduleJob("0 */2 * * * *", async () => {
    if (global.rotationJobRunning) {
      console.log("[JOB] Previous run still active, skipping.");
      return;
    }

    global.rotationJobRunning = true;

    try {
      console.log("[JOB] Rotation started", new Date().toISOString());

      // Fetch all products
      const { products: allProducts } = await getAllProducts(admin);

      const activeProducts = allProducts.filter(p => p.status === "ACTIVE");
      const draftProducts = allProducts.filter(p => p.status === "DRAFT");

      console.log(`[JOB] ACTIVE: ${activeProducts.length}, DRAFT: ${draftProducts.length}`);

      // Prepare update payloads
      const deactivatePayload = activeProducts.map(p => ({ id: p.id, status: "DRAFT" }));
      const activatePayload = draftProducts.slice(0, ACTIVE_LIMIT).map(p => ({ id: p.id, status: "ACTIVE" }));
      const combinedUpdates = [...deactivatePayload, ...activatePayload];

      if (combinedUpdates.length > 0) {
        console.log(`[JOB] Updating ${combinedUpdates.length} products...`);
        await batchUpdateProducts(admin, combinedUpdates);
      }

      // Update last run timestamp in metaobject
      await updateNextRunMetaobject(admin, METAOBJECT_GID, { lastRun: new Date().toISOString() });

      console.log(`[JOB] Completed successfully — ACTIVE=${activatePayload.length}`);
    } catch (error) {
      console.error("[JOB] Rotation failed:", error);
    } finally {
      global.rotationJobRunning = false;
    }
  });
}