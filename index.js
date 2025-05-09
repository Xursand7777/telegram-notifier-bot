// index.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const {
  getGroupIds,
  readLocalGroupIds,
  writeLocalGroupIds
} = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function loadGroupIds() {
  const cached = readLocalGroupIds();
  if (cached.length) {
    console.log("✅ Loaded group IDs from local cache");
    return cached;
  }
  console.log("⚠️ Local cache empty, fetching from JSONBin");
  const fresh = await getGroupIds();
  writeLocalGroupIds(fresh);
  return fresh;
}

(async () => {
  const message = `🚀 Hello everyone! (${new Date().toLocaleString()})`;
  const groupIds = await loadGroupIds();
  if (!groupIds.length) {
    console.log("⚠️ No group IDs to send to.");
    return;
  }
  for (const chatId of groupIds) {
    try {
      await bot.sendMessage(chatId, message);
      console.log(`✅ Sent to ${chatId}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${chatId}:`, err.message);
    }
  }
})();
