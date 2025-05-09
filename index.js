const axios = require("axios");
const { get, set } = require("@vercel/edge-config");

const cooldown = 60 * 60 * 1000; // 1 hour

const sendMessage = async (message) => {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const now = Date.now();
    const lastSentStr = await get("lastSent");
    const lastSent = parseInt(lastSentStr || "0", 10);

    if (now - lastSent < cooldown) {
      console.log("Message already sent recently. Skipping...");
      return;
    }

    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
    console.log("Message sent successfully");

    await set("lastSent", now.toString());
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
  }
};

module.exports = async (req, res) => {
  await sendMessage("Hello from your Telegram Notifier Bot!");
  res.status(200).send("Done");
};
