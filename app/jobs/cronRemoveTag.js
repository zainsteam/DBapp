import schedule from "node-schedule";
import { getDraftProducts } from "../fun/getdraftproducts.js";
import { removeProductTag } from "../fun/removeProductTag.js";

/**
 * Start a cron job to remove a tag from all draft products every 1 hour
 * @param {object} admin - Shopify Admin API client
 * @param {string} tag - Tag to remove
 */
export function startRemoveTagCron(admin, tag = "no-rotation") {
  if (global.removeTagJobStarted) return;
  global.removeTagJobStarted = true;

  console.log("Scheduled cron job: remove tag from draft products every 1 hour");

  // Runs every hour at minute 0
  schedule.scheduleJob("0 * * * *", async () => {

    // Job lock: prevent overlapping runs
    if (global.removeTagJobRunning) {
      console.log("Previous job still running, skipping this run.");
      return;
    }

    global.removeTagJobRunning = true;

    try {
      console.log(new Date().toISOString(), "→ Fetching draft products...");

      let after = undefined;
      let allDraftProducts = [];

      // Fetch all draft products (paginated)
      do {
        const { edges, pageInfo } = await getDraftProducts(admin, { first: 50, after }, "DRAFT");
        const products = edges.map(edge => edge.node);
        allDraftProducts = allDraftProducts.concat(products);

        after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
      } while (after);

      console.log(allDraftProducts.length, "draft products found.");

      if (allDraftProducts.length === 0) {
        console.log("No draft products found, skipping tag removal.");
        return;
      }

      // Remove the tag from fetched products
      const updated = await removeProductTag(admin, allDraftProducts, tag, 25, "DRAFT");

      console.log(updated.length, "products updated (tag removed).");
    } catch (err) {
      console.error("Error in remove-tag cron job:", err);
    } finally {
      // Release lock
      global.removeTagJobRunning = false;
    }
  });
}
