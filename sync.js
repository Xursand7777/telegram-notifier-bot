// sync.js
require("dotenv").config();
const axios = require("axios");
const {
  getGroupIds,
  readPendingGroupIds,
  writeLocalGroupIds,
  writePendingGroupIds
} = require("./listener");

const BASE_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;
const HEADERS  = {
  "X-Master-Key": process.env.JSONBIN_API_KEY,
  "Content-Type": "application/json"
};

(async () => {
  const existing = await getGroupIds();
  const pending  = readPendingGroupIds();
  const merged   = Array.from(new Set([...existing, ...pending]));

  if (merged.length > existing.length) {
    console.log(`📤 Syncing ${merged.length - existing.length} new IDs to JSONBin…`);
    await axios.put(BASE_URL, { group_ids: merged }, { headers: HEADERS });
    writeLocalGroupIds(merged);
    writePendingGroupIds([]);
    console.log("✅ Sync complete.");
  } else {
    console.log("ℹ️ No new group IDs to sync.");
  }
})();
