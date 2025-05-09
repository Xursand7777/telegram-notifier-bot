// index.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { getGroupIds } = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

const sendScheduledMessage = async () => {
  const message = `🚀 Hello from GitHub Actions! (${new Date().toLocaleString()})`;

  try {
    const groupIds = await getGroupIds();
    if (!groupIds.length) {
      console.log("⚠️ No group IDs to send to.");
      return;
    }

    for (const chatId of groupIds) {
      try {
        await bot.sendMessage(chatId, message);
        console.log(`✅ Sent message to group ${chatId}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${chatId}:`, err.response?.data || err.message);
      }
    }
  } catch (err) {
    console.error("❌ Global error in sending messages:", err.message);
    process.exit(1);
  }
};

sendScheduledMessage();
