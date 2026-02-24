import schedule from "node-schedule";
import PQueue from "p-queue";
import { updateNextRunMetaobject } from "../fun/updateMetaobject.js";

const METAOBJECT_GID = "gid://shopify/Metaobject/199390101750";
const ACTIVE_LIMIT = 3000;
const BATCH_SIZE = 50;       // Smaller batch to avoid throttling
const CONCURRENCY = 5;       // Fewer concurrent requests
const DELAY_BETWEEN_BATCHES = 100; // ms delay between batches

// Collections to keep ordered by tag priority
// const COLLECTION_IDS = [
//   "gid://shopify/Collection/657513939125", // c1
//   "gid://shopify/Collection/657514004661", // c2
//   "gid://shopify/Collection/657514037429", // c3
// ];
const COLLECTION_IDS = [
  "gid://shopify/Collection/479068455158", // c1
  "gid://shopify/Collection/479068487926", // c2
  "gid://shopify/Collection/479068520694", // c3
];

// Metafield configuration for "assign" counter
const ASSIGN_METAFIELD = {
  namespace: "custom",       // adjust if you use a different namespace
  key: "assign",
  type: "number_integer",
};

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
                tags
                metafield(namespace: "custom", key: "assign") {
                  id
                  value
                  type
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
    products.push(...edges.map(e => e.node));

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    await new Promise(r => setTimeout(r, 150)); // Rate limit buffer
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
   Collection sorting helpers
   Order: new → slightly-used → used
   Within each group: newest first
-------------------------------- */
async function getCollectionProducts(admin, collectionId) {
  let products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `
        query ($id: ID!, $first: Int!, $after: String) {
          collection(id: $id) {
            products(first: $first, after: $after) {
              edges {
                cursor
                node {
                  id
                  createdAt
                  tags
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      { variables: { id: collectionId, first: 250, after: cursor } }
    );

    const json = await response.json();

    if (json.errors) {
      console.error("[GRAPHQL ERRORS in getCollectionProducts]:", json.errors);
      break;
    }

    const connection = json?.data?.collection?.products;
    if (!connection) break;

    const { edges, pageInfo } = connection;
    products.push(...edges.map(e => e.node));

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    await new Promise(r => setTimeout(r, 50)); // small rate limit buffer
  }

  return products;
}

function sortProductsByTagAndCreatedAt(products) {
  const hasTag = (product, tag) => Array.isArray(product.tags) && product.tags.includes(tag);

  const newProducts = products.filter(p => hasTag(p, "new"));
  const slightlyUsedProducts = products.filter(p => hasTag(p, "slightly-used"));
  const usedProducts = products.filter(p => hasTag(p, "used"));

  const sortByCreatedDesc = (a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  newProducts.sort(sortByCreatedDesc);
  slightlyUsedProducts.sort(sortByCreatedDesc);
  usedProducts.sort(sortByCreatedDesc);

  // Products without any of these tags keep their relative order at the end
  const taggedIds = new Set(
    [...newProducts, ...slightlyUsedProducts, ...usedProducts].map(p => p.id)
  );
  const otherProducts = products.filter(p => !taggedIds.has(p.id));

  return [...newProducts, ...slightlyUsedProducts, ...usedProducts, ...otherProducts];
}

async function reorderCollectionProducts(admin, collectionId) {
  const products = await getCollectionProducts(admin, collectionId);
  if (!products.length) {
    console.log(`[JOB] No products to reorder for collection ${collectionId}`);
    return;
  }

  const sorted = sortProductsByTagAndCreatedAt(products);

  const moves = sorted.map((p, index) => ({
    id: p.id,
    newPosition: String(index + 1),
  }));

  try {
    // Ensure collection is manually sorted before reordering
    const updateResponse = await admin.graphql(
      `
        mutation collectionSetManualSort($input: CollectionInput!) {
          collectionUpdate(input: $input) {
            collection {
              id
              sortOrder
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
          input: {
            id: collectionId,
            sortOrder: "MANUAL",
          },
        },
      }
    );

    const updateJson = await updateResponse.json();
    const updateResult = updateJson?.data?.collectionUpdate;

    if (updateResult?.userErrors?.length) {
      console.error(
        `[JOB] Collection update (set MANUAL) errors for ${collectionId}:`,
        updateResult.userErrors.map(e => e.message)
      );
      return;
    }

    // Shopify limits moves array size, so send in small chunks
    const MAX_MOVES_PER_CALL = 250;

    for (let i = 0; i < moves.length; i += MAX_MOVES_PER_CALL) {
      const movesChunk = moves.slice(i, i + MAX_MOVES_PER_CALL);

      const response = await admin.graphql(
        `
          mutation collectionReorderProducts($id: ID!, $moves: [MoveInput!]!) {
            collectionReorderProducts(id: $id, moves: $moves) {
              job {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        { variables: { id: collectionId, moves: movesChunk } }
      );

      const json = await response.json();
      const result = json?.data?.collectionReorderProducts;

      if (result?.userErrors?.length) {
        console.error(
          `[JOB] Collection reorder errors for ${collectionId} (chunk starting at ${i}):`,
          result.userErrors.map(e => e.message)
        );
        // If a chunk fails, stop further reordering attempts for safety
        break;
      } else {
        console.log(
          `[JOB] Collection reorder enqueued for ${collectionId} (chunk starting at ${i})`,
          result?.job?.id
        );
      }

      // small delay between chunks
      await new Promise(r => setTimeout(r, 50));
    }
  } catch (error) {
    console.error(`[JOB] Failed to reorder collection ${collectionId}:`, error?.message || error);
  }
}

/* -------------------------------
   Helper: pick random items
-------------------------------- */
function pickRandomItems(array, count) {
  if (!array.length || count <= 0) return [];
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

/* -------------------------------
   Scheduler
-------------------------------- */
export function startNextRunJob(admin) {
  if (global.rotationJobStarted) return;
  global.rotationJobStarted = true;

  console.log("[JOB] Product rotation scheduler started");


  const rule = new schedule.RecurrenceRule();
  rule.tz = "Asia/Karachi";   // PKT timezone
  rule.second = 0;
  rule.minute = 50; // 50 minutes past the hour
  rule.hour = new schedule.Range(5, 23, 3); // 5,8,11,14,17,20,23

  // Runs every 3 hours (adjust as needed)
  schedule.scheduleJob(rule, async () => {
    // Runs every 3 minutes (adjust as needed)
    // schedule.scheduleJob("0 */3 * * * *", async () => {
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

      // Deactivate all currently active products
      const deactivatePayload = activeProducts.map(p => ({ id: p.id, status: "DRAFT" }));

      // From draft products, randomly activate up to ACTIVE_LIMIT with 50/30/20 tag split
      const totalDraftCount = draftProducts.length;
      const targetToActivate = Math.min(ACTIVE_LIMIT, totalDraftCount);

      let activatePayload = [];

      if (targetToActivate > 0) {
        const hasTag = (product, tag) => Array.isArray(product.tags) && product.tags.includes(tag);

        const draftNew = draftProducts.filter(p => hasTag(p, "new"));
        const draftSlightlyUsed = draftProducts.filter(p => hasTag(p, "slightly-used"));
        const draftUsed = draftProducts.filter(p => hasTag(p, "used"));

        const newTarget = Math.floor(targetToActivate * 0.5);
        const slightlyUsedTarget = Math.floor(targetToActivate * 0.3);
        const usedTarget = targetToActivate - newTarget - slightlyUsedTarget; // ensures sum == targetToActivate

        const pickedNew = pickRandomItems(draftNew, newTarget);
        const pickedSlightlyUsed = pickRandomItems(draftSlightlyUsed, slightlyUsedTarget);
        const pickedUsed = pickRandomItems(draftUsed, usedTarget);
        console.log(`[JOB] Picked New: ${pickedNew.length}, Slightly Used: ${pickedSlightlyUsed.length}, Used: ${pickedUsed.length}`);

        let chosen = [...pickedNew, ...pickedSlightlyUsed, ...pickedUsed];
        let remainingSlots = targetToActivate - chosen.length;

        if (remainingSlots > 0) {
          const chosenIds = new Set(chosen.map(p => p.id));
          const remainingPool = draftProducts.filter(
            p =>
              (hasTag(p, "new") || hasTag(p, "slightly-used") || hasTag(p, "used")) &&
              !chosenIds.has(p.id)
          );

          const extra = pickRandomItems(remainingPool, remainingSlots);
          chosen = [...chosen, ...extra];
          console.log(`[JOB] Added ${extra.length} extra products to chosen`);
          console.log(`[JOB] Chosen: ${chosen.length}`);
        }

        // Build activation payload and increment "assign" metafield via productUpdate
        activatePayload = chosen.map(p => {
          const currentVal = Number(p.metafield?.value ?? 0);
          const nextVal = Number.isNaN(currentVal) ? 1 : currentVal + 1;

          return {
            id: p.id,
            status: "ACTIVE",
            metafields: [
              {
                namespace: ASSIGN_METAFIELD.namespace,
                key: ASSIGN_METAFIELD.key,
                type: ASSIGN_METAFIELD.type,
                value: String(nextVal),
              },
            ],
          };
        });
      }

      const combinedUpdates = [...deactivatePayload, ...activatePayload];

      if (combinedUpdates.length > 0) {
        console.log(`[JOB] Updating ${combinedUpdates.length} products...`);
        await batchUpdateProducts(admin, combinedUpdates);
      }

      // Update last run timestamp in metaobject
      await updateNextRunMetaobject(admin, METAOBJECT_GID, { lastRun: new Date().toISOString() });

      // Reorder key collections by tag priority after updates
      for (const collectionId of COLLECTION_IDS) {
        await reorderCollectionProducts(admin, collectionId);
      }



      console.log(`[JOB] Completed successfully — ACTIVE=${activatePayload.length}`);
    } catch (error) {
      console.error("[JOB] Rotation failed:", error);
    } finally {
      global.rotationJobRunning = false;
    }
  });
}