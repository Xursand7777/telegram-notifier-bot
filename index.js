const axios = require("axios");
const { get } = require("@vercel/edge-config");

// Replace with your actual Edge Config ID from the dashboard
const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;

const WRITE_TOKEN = process.env.EDGE_CONFIG_WRITE_TOKEN;
const cooldown = 60 * 60 * 1000; // 1 hour

// Update Edge Config using the REST API
const updateLastSent = async (timestamp) => {
  const url = `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`;

  try {
    await axios.patch(
      url,
      {
        items: [
          {
            operation: "update",
            key: "lastSent",
            value: timestamp.toString(),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${WRITE_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Failed to update Edge Config:", err.response?.data || err.message);
  }
};

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

    await updateLastSent(now);
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
  }
};

module.exports = async (req, res) => {
  await sendMessage("Hello from your Telegram Notifier Bot!");
  res.status(200).send("Done");
};
