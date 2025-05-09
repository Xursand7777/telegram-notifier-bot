// listener.js
require("dotenv").config();
const fs    = require("fs");
const path  = require("path");
const axios = require("axios");

const BIN_ID   = process.env.JSONBIN_BIN_ID;
const API_KEY  = process.env.JSONBIN_API_KEY;
const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS  = {
  "X-Master-Key": API_KEY,
  "Content-Type": "application/json"
};

// Local cache file paths
const GROUP_FILE   = path.resolve(__dirname, "group_ids.json");
const PENDING_FILE = path.resolve(__dirname, "pendingGroupIds.json");

// Read/write local cache
function readLocalGroupIds() {
  if (!fs.existsSync(GROUP_FILE)) return [];
  return JSON.parse(fs.readFileSync(GROUP_FILE, "utf-8"));
}
function writeLocalGroupIds(ids) {
  fs.writeFileSync(GROUP_FILE, JSON.stringify(ids, null, 2));
}
function readPendingGroupIds() {
  if (!fs.existsSync(PENDING_FILE)) return [];
  return JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
}
function writePendingGroupIds(ids) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(ids, null, 2));
}

// Fetch the current list from JSONBin (used only on first seed)
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

// (Optional/manual use) Add a single group ID into JSONBin
async function addGroupId(newId) {
  console.log(`📥 Trying to add group ID: ${newId}`);
  const existing = await getGroupIds();
  if (!existing.includes(newId)) {
    const updated = [...existing, newId];
    try {
      await axios.put(BASE_URL, { group_ids: updated }, { headers: HEADERS });
      console.log(`✅ Added new group ID: ${newId}`);
    } catch (err) {
      console.error("❌ Failed to update JSONBin:", err.message);
    }
  } else {
    console.log(`ℹ️ Group ID ${newId} already in JSONBin.`);
  }
}

module.exports = {
  getGroupIds,
  addGroupId,
  readLocalGroupIds,
  writeLocalGroupIds,
  readPendingGroupIds,
  writePendingGroupIds
};
