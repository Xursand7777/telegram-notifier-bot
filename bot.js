require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { addGroupId } = require("./listener");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const now = Date.now();
const END = now + 60 * 1000;

console.log("🤖 Bot polling for group joins (60s window)...");

bot.on("my_chat_member", async (msg) => {
  const status = msg.new_chat_member?.status;
  const chatId = msg.chat?.id;

  if (status === "administrator" && chatId) {
    await addGroupId(chatId);
    await bot.sendMessage(chatId, "✅ Bot added! You’ll get updates every 2 hours.");
  }
});

setTimeout(() => {
  console.log("🛑 Polling ended after 60s.");
  process.exit(0);
}, END - now);
if (process.env.GITHUB_ACTIONS) {
  console.log("⚠️ Skipping bot polling on GitHub Actions.");
  process.exit(0);
}
