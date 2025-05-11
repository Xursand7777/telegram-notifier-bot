require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { getGroupIds } = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

;(async () => {
  const groupIds = await getGroupIds();
  const message = `🚀 Hello from GitHub Actions! (${new Date().toLocaleString()})`;

  if (!groupIds.length) {
    console.log("⚠️ No group IDs found, nothing to send.");
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
