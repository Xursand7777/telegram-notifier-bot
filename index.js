const axios = require("axios");
const { get, set } = require("@vercel/edge-config");

const cooldown = 60 * 60 * 1000;  // 1 hour in milliseconds

const sendMessage = async (message) => {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const now = Date.now();
    const lastSent = parseInt(await get("lastSent") || "0", 10);

    // Check if the last message was sent within the cooldown period
    if (now - lastSent < cooldown) {
      console.log("Message already sent recently. Skipping...");
      return;
    }

    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
    console.log("Message sent successfully");

    // Update the timestamp in Vercel Edge Config
    await set("lastSent", now.toString());
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
  }
};

// Exporting as a serverless function for Vercel
module.exports = async (req, res) => {
  await sendMessage("Hello from your Telegram Notifier Bot!");
  res.status(200).send("Message sent");
};
