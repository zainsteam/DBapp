import schedule from "node-schedule";
import { updateNextRunMetaobject } from "../fun/updateMetaobject.js";
import { getDraftProducts } from "../fun/getdraftproducts.js";
import { assignNextProductsTag } from "../fun/updatetag.js";
import { updateProductMetafield } from "../fun/updateProductMetafield.js";

const METAOBJECT_GID = "gid://shopify/Metaobject/247407607989";

/**
 * Get all draft products from the store with pagination
 *
 * @param {object} admin - Shopify Admin API client
 * @returns {Promise<Array>} Array of all draft product edges
 */
async function getAllDraftProducts(admin) {
  const status = "DRAFT";
  let allEdges = [];
  let cursor = null;
  let hasNextPage = true;

  console.log("[JOB] Fetching all draft products...");

  while (hasNextPage) {
    const { edges, pageInfo } = await getDraftProducts(
      admin,
      { first: 100, after: cursor },
      status
    );

    allEdges.push(...edges);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    console.log(`[JOB] Fetched ${allEdges.length} draft products so far...`);
  }

  console.log(`[JOB] Total draft products fetched: ${allEdges.length}`);
  return allEdges;
}

/**
 * Get all active products with a specific tag from the store with pagination
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} tag - Tag to filter by
 * @returns {Promise<Array>} Array of all product edges
 */
async function getActiveProductsWithTag(admin, tag) {
  // Query for ACTIVE products with the specified tag
  const status = `ACTIVE tag:${tag}`;
  let allEdges = [];
  let cursor = null;
  let hasNextPage = true;

  console.log(`[JOB] Fetching all active products with tag "${tag}"...`);

  while (hasNextPage) {
    const { edges, pageInfo } = await getDraftProducts(
      admin,
      { first: 100, after: cursor },
      status
    );

    allEdges.push(...edges);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    console.log(`[JOB] Fetched ${allEdges.length} active products with tag "${tag}" so far...`);
  }

  console.log(`[JOB] Total active products with tag "${tag}" fetched: ${allEdges.length}`);
  return allEdges;
}

/**
 * Get all draft products with a specific tag from the store with pagination
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} tag - Tag to filter by
 * @returns {Promise<Array>} Array of all product edges
 */
async function getDraftProductsWithTag(admin, tag) {
  // Query for DRAFT products with the specified tag
  const status = `DRAFT tag:${tag}`;
  let allEdges = [];
  let cursor = null;
  let hasNextPage = true;

  console.log(`[JOB] Fetching all draft products with tag "${tag}"...`);

  while (hasNextPage) {
    const { edges, pageInfo } = await getDraftProducts(
      admin,
      { first: 100, after: cursor },
      status
    );

    allEdges.push(...edges);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    console.log(`[JOB] Fetched ${allEdges.length} draft products with tag "${tag}" so far...`);
  }

  console.log(`[JOB] Total draft products with tag "${tag}" fetched: ${allEdges.length}`);
  return allEdges;
}

/**
 * Get product metafield value
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} productGid - Product GID
 * @param {string} namespace - Metafield namespace
 * @param {string} key - Metafield key
 * @returns {Promise<number|null>} Current metafield value or null if not found
 */
async function getProductMetafieldValue(admin, productGid, namespace, key) {
  try {
    const response = await admin.graphql(
      `#graphql
      query getProductMetafield($id: ID!, $namespace: String!, $key: String!) {
        product(id: $id) {
          id
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            value
            type
          }
        }
      }`,
      {
        variables: {
          id: productGid,
          namespace,
          key,
        },
      }
    );

    const result = response?.body?.data?.product?.metafield || response?.data?.product?.metafield;

    if (result?.value) {
      return parseInt(result.value, 10) || 0;
    }

    return 0; // Default to 0 if metafield doesn't exist
  } catch (error) {
    console.error(`[JOB] Error fetching metafield for ${productGid}:`, error?.message || error);
    return 0;
  }
}

/**
 * Increment product "assign" metafield by 1
 *
 * @param {object} admin - Shopify Admin API client
 * @param {string} productGid - Product GID
 * @param {string} namespace - Metafield namespace (default: "custom")
 * @param {string} key - Metafield key (default: "assign")
 * @returns {Promise<boolean>} Success status
 */
async function incrementAssignMetafield(admin, productGid, namespace = "custom", key = "assign") {
  try {
    // Get current value
    const currentValue = await getProductMetafieldValue(admin, productGid, namespace, key);
    const newValue = (currentValue || 0) + 1;

    // Update metafield
    const success = await updateProductMetafield(admin, productGid, {
      namespace,
      key,
      type: "number_integer",
      value: newValue.toString(),
    });

    if (success) {
      console.log(`[JOB] Incremented ${namespace}.${key} for ${productGid}: ${currentValue} → ${newValue}`);
    }

    return success;
  } catch (error) {
    console.error(`[JOB] Error incrementing metafield for ${productGid}:`, error?.message || error);
    return false;
  }
}

/**
 * Starts the scheduled job once per process
 *
 * @param {object} admin - Shopify Admin API client
 */
export function startNextRunJob(admin) {
  if (global.nextRunJobStarted) {
    return;
  }

  global.nextRunJobStarted = true;

  console.log("[JOB] Starting nextRun scheduler");

  // Every second
  schedule.scheduleJob("0 */10 * * * *", async () => {
    // Job lock: prevent overlapping runs
    if (global.nextRunJobRunning) {
      console.log("[JOB] Previous job still running, skipping this run.");
      return;
    }

    global.nextRunJobRunning = true;

    try {
      console.log("[JOB] Tick", new Date().toISOString());

      // First, get all draft products
      const draftProductEdges = await getAllDraftProducts(admin);

      // Extract product nodes from edges
      const draftProducts = draftProductEdges.map(edge => edge.node);

      // Add "nextproducts" tag to each draft product
      if (draftProducts.length > 0) {
        console.log(`[JOB] Adding "nextproducts" tag to ${draftProducts.length} draft products...`);
        const updatedProducts = await assignNextProductsTag(
          admin,
          draftProducts,
          "nextproducts",
          null, // No status change
          25,   // Batch size
          "DRAFT" // Filter status
        );
        console.log(`[JOB] Successfully tagged ${updatedProducts.length} products with "nextproducts"`);
      }

      // Get active products with "currentproducts" tag and make them draft
      const activeProductEdges = await getActiveProductsWithTag(admin, "currentproducts");
      const activeProducts = activeProductEdges.map(edge => edge.node);

      if (activeProducts.length > 0) {
        console.log(`[JOB] Making ${activeProducts.length} active products with "currentproducts" tag draft and replacing tag with "no-rotation"...`);
        // Replace "currentproducts" tag with "no-rotation" and update status to DRAFT
        const updatedToDraft = await assignNextProductsTag(
          admin,
          activeProducts,
          "no-rotation", // New tag to add
          "DRAFT", // Update status to DRAFT
          25,   // Batch size
          "ACTIVE", // Filter status
          "currentproducts" // Tag to replace
        );
        console.log(`[JOB] Successfully made ${updatedToDraft.length} products draft and replaced "currentproducts" with "no-rotation"`);
      }

      // Get draft products with "nextproducts" tag and activate them
      const nextProductEdges = await getDraftProductsWithTag(admin, "nextproducts");
      const nextProducts = nextProductEdges.map(edge => edge.node);

      if (nextProducts.length > 0) {
        console.log(`[JOB] Activating ${nextProducts.length} draft products with "nextproducts" tag...`);
        // Activate products with "nextproducts" tag and replace tag with "currentproducts"
        const activatedProducts = await assignNextProductsTag(
          admin,
          nextProducts,
          "currentproducts", // New tag to add
          "ACTIVE", // Update status to ACTIVE
          25,   // Batch size
          "DRAFT", // Filter status
          "nextproducts" // Tag to replace
        );
        console.log(`[JOB] Successfully activated ${activatedProducts.length} products and replaced "nextproducts" with "currentproducts"`);

        // Increment "assign" metafield for each activated product
        if (activatedProducts.length > 0) {
          console.log(`[JOB] Incrementing "assign" metafield for ${activatedProducts.length} activated products...`);
          let successCount = 0;
          for (const product of activatedProducts) {
            const productGid = product.id.toString().startsWith("gid://")
              ? product.id
              : `gid://shopify/Product/${product.id}`;

            const success = await incrementAssignMetafield(admin, productGid);
            if (success) {
              successCount++;
            }
            // Rate-limit safety
            await new Promise((r) => setTimeout(r, 150));
          }
          console.log(`[JOB] Successfully incremented "assign" metafield for ${successCount} products`);
        }
      }

      // Then update the shop metaobject
      await updateNextRunMetaobject(admin, METAOBJECT_GID);

      console.log(`[JOB] Completed - Processed ${draftProducts.length} draft products, ${activeProducts.length} active products, and ${nextProducts.length} next products`);
    } catch (error) {
      console.error("[JOB] Error in scheduled job:", error);
    } finally {
      // Release lock
      global.nextRunJobRunning = false;
    }
  });
}
