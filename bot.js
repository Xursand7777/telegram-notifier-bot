require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { addGroupId } = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const WINDOW = 3 * 60 * 1000; 

console.log("🤖 Polling for group joins (180s)…");

bot.on("my_chat_member", async (msg) => {
  const chatId = msg.chat?.id;
  const status = msg.new_chat_member?.status;
  if (status === "administrator" && chatId) {
    await addGroupId(chatId);
    await bot.sendMessage(chatId, "✅ Bot added! You’ll get updates every 2 hours.");
  }
});

setTimeout(() => {
  console.log("🛑 Poll window ended—exiting.");
  process.exit(0);
}, WINDOW);
