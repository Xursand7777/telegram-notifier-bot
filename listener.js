require("dotenv").config();
const axios = require("axios");

const BIN_ID   = process.env.JSONBIN_BIN_ID;
const API_KEY  = process.env.JSONBIN_API_KEY;
const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS  = {
  "X-Master-Key": API_KEY,
  "Content-Type": "application/json"
};

async function getGroupIds() {
  try {
    console.log("📡 Fetching group IDs from JSONBin…");
    const res = await axios.get(`${BASE_URL}/latest`, { headers: HEADERS });
    return res.data.record?.group_ids || [];
  } catch (err) {
    console.error("❌ Failed to fetch group IDs:", err.message);
    return [];
  }
}

async function addGroupId(newId) {
  console.log(`📥 Adding new group ID ${newId}…`);
  const existing = await getGroupIds();
  if (!existing.includes(newId)) {
    const updated = [...existing, newId];
    try {
      await axios.put(BASE_URL, { group_ids: updated }, { headers: HEADERS });
      console.log(`✅ Successfully added ${newId}`);
    } catch (err) {
      console.error("❌ Failed to update JSONBin:", err.message);
    }
  } else {
    console.log(`ℹ️ ${newId} already present, skipping.`);
  }
}

module.exports = { getGroupIds, addGroupId };
