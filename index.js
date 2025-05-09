const axios = require("axios");

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
  }
};

// Exporting as a serverless function for Vercel
module.exports = async (req, res) => {
  await sendMessage("Hello from your Telegram Notifier Bot!");
  res.status(200).send("Message sent");
};
    