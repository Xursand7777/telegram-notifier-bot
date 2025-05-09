// sync.js
require("dotenv").config();
const axios = require("axios");
const {
  readLocalGroupIds,
  readPendingGroupIds,
  writeLocalGroupIds,
  writePendingGroupIds,
  getGroupIds
} = require("./listener");

const BASE_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;
const HEADERS  = {
  "X-Master-Key": process.env.JSONBIN_API_KEY,
  "Content-Type": "application/json"
};

(async () => {
  let existing = readLocalGroupIds();

  // Seed cache on first-ever run
  if (!existing.length) {
    console.log("⚠️ Local cache empty—seeding from JSONBin");
    try {
      existing = await getGroupIds();
      writeLocalGroupIds(existing);
      console.log(`✅ Seeded ${existing.length} IDs`);
    } catch (err) {
      console.error("❌ Initial fetch failed:", err.message);
      return;
    }
  }

  // Merge and PUT only if there are new IDs
  const pending = readPendingGroupIds();
  const merged  = Array.from(new Set([...existing, ...pending]));

  if (merged.length > existing.length) {
    console.log(`📤 PUT ${merged.length - existing.length} new IDs to JSONBin…`);
    await axios.put(BASE_URL, { group_ids: merged }, { headers: HEADERS });
    writeLocalGroupIds(merged);
    writePendingGroupIds([]);  // clear queue
    console.log("✅ Sync complete.");
  } else {
    console.log("ℹ️ No new IDs—skipping PUT.");
  }
})();
