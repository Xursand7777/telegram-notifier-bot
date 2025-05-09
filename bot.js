// bot.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const {
  readPendingGroupIds,
  writePendingGroupIds
} = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log("🤖 Listening for group joins…");

bot.on("my_chat_member", (msg) => {
  const status = msg.new_chat_member?.status;
  const chatId = msg.chat?.id;
  if (status === "administrator" && chatId) {
    const queue = new Set(readPendingGroupIds());
    if (!queue.has(chatId)) {
      queue.add(chatId);
      writePendingGroupIds([...queue]);
      console.log(`➕ Queued new group ID: ${chatId}`);
    }
    bot.sendMessage(chatId, "✅ Bot added! You’ll get updates shortly.");
  }
});
