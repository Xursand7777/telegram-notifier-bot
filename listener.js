require("dotenv").config();
const axios = require("axios");

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = {
  "X-Master-Key": API_KEY,
  "Content-Type": "application/json"
};

// ✅ Get group IDs
async function getGroupIds() {
  try {
    const res = await axios.get(`${BASE_URL}/latest`, { headers: HEADERS });
    const groupIds = res.data.record?.group_ids || [];
    return Array.isArray(groupIds) ? groupIds : [];
  } catch (err) {
    console.error("❌ Failed to fetch group IDs:", err.message);
    return [];
  }
}

// ✅ Add a new group ID (called when bot is added to new group)
async function addGroupId(newId) {
  const existing = await getGroupIds();
  if (!existing.includes(newId)) {
    const updated = [...existing, newId];
    try {
      await axios.put(`${BASE_URL}`, { group_ids: updated }, { headers: HEADERS });
      console.log(`✅ Added new group ID: ${newId}`);
    } catch (err) {
      console.error("❌ Failed to update group list:", err.message);
    }
  } else {
    console.log(`ℹ️ Group ID ${newId} already exists`);
  }
}

module.exports = { getGroupIds, addGroupId };
