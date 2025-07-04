require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require('fs').promises;
const path = require('path');

// --- Configuration ---
const DATA_FILE = path.join(__dirname, 'group_ids.json');
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// --- In-memory session storage (for demonstration purposes) ---
// In a real application, you should use a database (like Redis or a SQL DB) for user sessions.
const userSessions = {};

console.log(`🤖 Bot started at ${new Date().toLocaleString()}`);

// --- Helper Functions for Group Management ---

async function getGroupIds() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data).group_ids || [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(DATA_FILE, JSON.stringify({ group_ids: [] }, null, 2));
      return [];
    }
    console.error("❌ Error reading group IDs:", err.message);
    return [];
  }
}

async function addGroupId(newId) {
  const existing = await getGroupIds();
  if (!existing.includes(newId)) {
    const updated = [...existing, newId];
    await fs.writeFile(DATA_FILE, JSON.stringify({ group_ids: updated }, null, 2));
    console.log(`✅ Added group ${newId}`);
    return true;
  }
  return false;
}

async function removeGroupId(groupId) {
  const existing = await getGroupIds();
  if (existing.includes(groupId)) {
    const updated = existing.filter(id => id !== groupId);
    await fs.writeFile(DATA_FILE, JSON.stringify({ group_ids: updated }, null, 2));
    console.log(`🗑️ Removed group ${groupId}`);
  }
}

// --- Bot Logic for Private Chats ---

const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "🚀 Send Message to Groups" }],
      [{ text: "🔒 Logout" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

bot.on('message', async (msg) => {
  // Only handle private messages for this interactive logic
  if (msg.chat.type !== 'private') {
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text;
  const session = userSessions[chatId] || {};

  // --- Command Handling ---
  if (text === '/start') {
    userSessions[chatId] = { state: 'awaiting_phone' };
    return bot.sendMessage(chatId, "Welcome! To get started, please provide your phone number.");
  }

  if (text === '🔒 Logout') {
    delete userSessions[chatId];
    return bot.sendMessage(chatId, "You have been logged out.", {
      reply_markup: { remove_keyboard: true }
    });
  }

  // --- State Machine for Login and Actions ---
  switch (session.state) {
    case 'awaiting_phone':
      session.phone = text;
      session.state = 'awaiting_login';
      return bot.sendMessage(chatId, "Thank you. Now, please enter your login.");

    case 'awaiting_login':
      session.login = text;
      session.state = 'awaiting_password';
      return bot.sendMessage(chatId, "Great. Finally, please enter your password.");

    case 'awaiting_password':
      session.password = text;
      // --- IMPORTANT: Authentication Placeholder ---
      // In a real app, you would validate session.login and session.password against a database.
      // Storing passwords, even temporarily, is a security risk. This is for demonstration only.
      console.log(`Login attempt for user: ${session.login}`);
      session.state = 'authenticated';
      return bot.sendMessage(chatId, "✅ Login successful! What would you like to do?", mainMenu);

    case 'authenticated':
      if (text === '🚀 Send Message to Groups') {
        session.state = 'awaiting_message';
        return bot.sendMessage(chatId, "Please type the message you want to send to all groups.");
      }
      return bot.sendMessage(chatId, "Please choose an option from the menu.", mainMenu);

    case 'awaiting_message':
      const messageToSend = text;
      const groupIds = await getGroupIds();
      if (groupIds.length === 0) {
        await bot.sendMessage(chatId, "⚠️ There are no groups for me to send messages to.", mainMenu);
      } else {
        await bot.sendMessage(chatId, `Sending your message to ${groupIds.length} group(s)...`);
        let successCount = 0;
        for (const groupId of groupIds) {
          try {
            await bot.sendMessage(groupId, messageToSend);
            successCount++;
          } catch (err) {
            console.error(`Failed to send to ${groupId}:`, err.message);
          }
        }
        await bot.sendMessage(chatId, `✅ Message sent to ${successCount} out of ${groupIds.length} groups.`, mainMenu);
      }
      session.state = 'authenticated'; // Reset state to the main menu
      break;

    default:
      return bot.sendMessage(chatId, "I'm not sure what you mean. Please type /start to begin.");
  }
});

// --- Bot Logic for Group Management ---
// This part remains to automatically track which groups the bot is in.
bot.on("my_chat_member", async (msg) => {
  const chatId = msg.chat.id;
  const status = msg.new_chat_member.status;

  if (status === "administrator") {
    await addGroupId(chatId);
  } else if (status === "left" || status === "kicked") {
    await removeGroupId(chatId);
  }
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('🛑 Bot is shutting down...');
  bot.stopPolling();
  process.exit(0);
});