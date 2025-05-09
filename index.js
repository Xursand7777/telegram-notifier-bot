const axios = require("axios");
const { get } = require("@vercel/edge-config");

const cooldown = 60 * 1000; // 1 minute cooldown
const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
const WRITE_TOKEN = process.env.EDGE_CONFIG_WRITE_TOKEN;

let lastPostTime = 0;
const requestTimestamps = new Map();

const sendMessage = async (message) => {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
    console.log("Message sent successfully");
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
    throw error;
  }
};

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

module.exports = async (req, res) => {
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  // In-memory global cooldown
  if (now - lastPostTime < cooldown) {
    console.log("Throttled: Global cooldown.");
    return res.status(429).json({ error: "Global cooldown: wait 60s" });
  }

  // IP-based cooldown
  const lastRequestTime = requestTimestamps.get(ip) || 0;
  if (now - lastRequestTime < 5000) {
    console.log(`Throttled: Duplicate request from ${ip}.`);
    return res.status(429).json({ error: "Duplicate request: wait 5s" });
  }

  requestTimestamps.set(ip, now);
  setTimeout(() => requestTimestamps.delete(ip), 60000);

  try {
    const lastSentStr = await get("lastSent");
    const lastSent = parseInt(lastSentStr || "0", 10);
    if (now - lastSent < cooldown) {
      console.log("Message already sent recently. Skipping...");
      return res.status(200).send("Skipped due to cooldown");
    }

    await sendMessage("Hello from your Telegram Notifier Bot!");
    lastPostTime = now;
    await updateLastSent(now);
    res.status(200).send("Message sent");
  } catch (error) {
    console.error("Unexpected error in handler:", error);
    res.status(500).send("Internal Server Error");
  }
};