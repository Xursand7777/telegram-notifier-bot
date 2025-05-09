require("dotenv").config();
const axios = require("axios");

const chatId = process.env.TELEGRAM_CHAT_ID;
const token = process.env.TELEGRAM_BOT_TOKEN;

const url = `https://api.telegram.org/bot${token}/sendMessage`;

const message = `🚀 Hello from GitHub Actions! (${new Date().toLocaleString()})`;

axios.post(url, {
  chat_id: chatId,
  text: message,
}).then((res) => {
  console.log("✅ Message sent:", res.data);
  process.exit(0); // clean exit
}).catch((err) => {
  console.error("❌ Error sending message:", err.response?.data || err.message);
  process.exit(1);
});