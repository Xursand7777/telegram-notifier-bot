// bot.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { addGroupId } = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const now = Date.now();
const END = now + 180 * 1000; // increased to 3 minutes

console.log("🤖 Bot polling for group joins (180s window)...");

bot.on("my_chat_member", async (msg) => {
  console.log("🔍 New chat_member event:", JSON.stringify(msg, null, 2));

  const status = msg.new_chat_member?.status;
  const chatId = msg.chat?.id;

  if (status === "administrator" && chatId) {
    await addGroupId(chatId);
    await bot.sendMessage(chatId, "✅ Bot added! You’ll get updates every 2 hours.");
  } else {
    console.log(`⚠️ Status was '${status}', not 'administrator'. Skipping...`);
  }
});

setTimeout(() => {
  console.log("🛑 Polling ended after 180s.");
  process.exit(0);
}, END - now);
