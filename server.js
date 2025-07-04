require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require('fs').promises;
const path = require('path');

// --- Configuration ---
const DATA_FILE = path.join(__dirname, 'data.json');
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// In-memory session state (e.g., what is the bot waiting for from a user)
const userSessions = {};

console.log(`🤖 Bot started at ${new Date().toLocaleString()}`);

// --- Data Management Functions ---

async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaultData = { users: {} };
      await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    console.error("❌ Error reading data file:", err.message);
    return { users: {} };
  }
}

async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Error writing data file:", err.message);
  }
}

// --- Main Menu Definitions ---

const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "🚀 Send Message" }, { text: "⚙️ Settings" }],
      [{ text: "👤 My Profile" }, { text: "🔒 Logout" }]
    ],
    resize_keyboard: true,
  }
};

const sendMessageMenu = {
  inline_keyboard: [
    [{ text: "✍️ Send a Custom Message", callback_data: "send_custom" }],
    [{ text: "📨 Send Default Message Now", callback_data: "send_default" }]
  ]
};

const settingsMenu = {
  inline_keyboard: [
    [{ text: "✏️ Set Default Message", callback_data: "set_default_message" }],
    [{ text: "⏰ Set Notification Schedule", callback_data: "set_interval" }]
  ]
};

function generateHourKeyboard(callbackPrefix) {
  const keyboard = [];
  let row = [];
  for (let i = 0; i < 24; i++) {
    row.push({
      text: `${String(i).padStart(2, '0')}:00`,
      callback_data: `${callbackPrefix}${i}`
    });
    if (row.length === 6) {
      keyboard.push(row);
      row = [];
    }
  }
  return { inline_keyboard: keyboard };
}

// --- Main Message Handler ---

bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;

  const chatId = msg.chat.id;
  const text = msg.text;
  const session = userSessions[chatId] || {};

   if (text === '/start') {
    userSessions[chatId] = { state: 'awaiting_login' };
    return bot.sendMessage(chatId, "Welcome! Please enter your desired login name.");
  }

  if (text === '🔒 Logout') {
    const logoutConfirmationMenu = {
      inline_keyboard: [
        [
          { text: "✅ Yes, Logout & Delete Data", callback_data: "logout_confirm" },
          { text: "❌ No, Cancel", callback_data: "logout_cancel" }
        ]
      ]
    };
    return bot.sendMessage(
      chatId,
      "⚠️ *Are you sure?*\n\nLogging out will permanently delete all your settings, and the bot will leave all your groups.",
      { parse_mode: 'Markdown', reply_markup: logoutConfirmationMenu }
    );
  }

  if (text === '🚀 Send Message') {
    return bot.sendMessage(chatId, "How would you like to send a message?", { reply_markup: sendMessageMenu });
  }
  if (text === '⚙️ Settings') {
    return bot.sendMessage(chatId, "What would you like to configure?", { reply_markup: settingsMenu });
  }
if (text === '👤 My Profile') {
    const data = await readData();
    const user = data.users[chatId];
    if (user) {
      const settings = user.notificationSettings;
      
      // First send a "loading" message since getting group info might take time
      const loadingMsg = await bot.sendMessage(chatId, "📊 *Loading your profile...*", { parse_mode: 'Markdown' });
      
      // Get information about each group
      let groupsList = "";
      if (user.groups.length > 0) {
        groupsList = "\n\n*Groups:*\n";
        let counter = 1;
        
        for (const groupId of user.groups) {
          try {
            const chatInfo = await bot.getChat(groupId);
            const chatName = chatInfo.title || chatInfo.username || `Group ${groupId}`;
            groupsList += `${counter}. ${chatName}\n`;
            counter++;
          } catch (err) {
            console.error(`Failed to get info for group ${groupId}:`, err.message);
            groupsList += `${counter}. Unknown Group (ID: ${groupId})\n`;
            counter++;
          }
        }
      } else {
        groupsList = "\n\n*Groups:* No groups yet. Add this bot to groups as admin.";
      }
      
      const profileText = `
👤 *Your Profile*
*Login:* \`${user.login}\`
*Groups Managed:* ${user.groups.length}
*Notification Schedule:* Every ${settings.intervalHours} hours, starting at ${String(settings.startTime).padStart(2, '0')}:00
*Default Message:* "${settings.defaultMessage}"${groupsList}
      `;
      
      // Delete the loading message and send the complete profile
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      return bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    }
    return bot.sendMessage(chatId, "You don't seem to be logged in. Type /start");
  }

  switch (session.state) {
    case 'awaiting_login':
      session.login = text;
      session.state = 'awaiting_password';
      return bot.sendMessage(chatId, "Great. Now, please enter your password.");

    case 'awaiting_password':
      const data = await readData();
      const userExists = Object.values(data.users).some(u => u.login === session.login);
      if (userExists) {
        // In a real app, you would also verify the password here
        console.log(`Login success for: ${session.login}`);
      } else {
        data.users[chatId] = {
          login: session.login,
          password: text, // In a real app, HASH THIS PASSWORD!
          groups: [],
          notificationSettings: {
            enabled: true,
            intervalHours: 3,
            startTime: 8,
            defaultMessage: "This is a default periodic message.",
            lastNotified: null
          }
        };
        await writeData(data);
        console.log(`New user registered: ${session.login}`);
      }
      delete userSessions[chatId];
      await bot.sendMessage(chatId, "✅ Login successful! What would you like to do?", mainMenu);
      
      // Send the informational follow-up message
      return bot.sendMessage(chatId, "You can now add this bot as an administrator to your groups or channels. It will automatically detect and link them to your account.");
    
    case 'awaiting_custom_message':
      await sendGroupMessage(chatId, text);
      delete userSessions[chatId];
      break;

    case 'awaiting_default_message':
      const dataToUpdate = await readData();
      dataToUpdate.users[chatId].notificationSettings.defaultMessage = text;
      await writeData(dataToUpdate);
      await bot.sendMessage(chatId, "✅ Default message updated!");
      delete userSessions[chatId];
      break;
  }
});

// --- Inline Keyboard Callback Handler ---

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;
  const session = userSessions[chatId] || {};

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'send_custom') {
    userSessions[chatId] = { state: 'awaiting_custom_message' };
    bot.sendMessage(chatId, "Please type the custom message you want to send.");
  } else if (data === 'send_default') {
    const appData = await readData();
    const defaultMessage = appData.users[chatId]?.notificationSettings?.defaultMessage;
    if (defaultMessage) {
      await sendGroupMessage(chatId, defaultMessage);
    } else {
      bot.sendMessage(chatId, "⚠️ No default message is set.");
    }
  } else if (data === 'set_default_message') {
    userSessions[chatId] = { state: 'awaiting_default_message' };
    bot.sendMessage(chatId, "Please type your new default message.");
  } else if (data === 'set_interval') {
    const intervalMenu = {
      inline_keyboard: [
        [{ text: "2 Hours", callback_data: "interval_2" }, { text: "3 Hours", callback_data: "interval_3" }, { text: "4 Hours", callback_data: "interval_4" }],
        [{ text: "5 Hours", callback_data: "interval_5" }, { text: "6 Hours", callback_data: "interval_6" }, { text: "12 Hours", callback_data: "interval_12" }],
        [{ text: "24 Hours", callback_data: "interval_24" }]
      ]
    };
    bot.sendMessage(chatId, "First, choose a notification interval:", { reply_markup: intervalMenu });
  } else if (data.startsWith('interval_')) {
    const interval = parseInt(data.split('_')[1]);
    userSessions[chatId] = { interval: interval };
    const hourKeyboard = generateHourKeyboard('starttime_');
    bot.editMessageText(
      `Interval set to ${interval} hours.\n\nNow, please select the *start hour* (Tashkent Time, UTC+5).\nMessages will be sent every ${interval} hours starting from this hour.`,
      { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown', reply_markup: hourKeyboard }
    );
  } else if (data.startsWith('starttime_')) {
    const startTime = parseInt(data.split('_')[1]);
    const interval = session.interval;
    
    // Update settings with the new interval and start time
    const appDataForUpdate = await readData();
    const userSettings = appDataForUpdate.users[chatId].notificationSettings;
    userSettings.intervalHours = interval;
    userSettings.startTime = startTime;
    await writeData(appDataForUpdate);

    // Generate example notification times for the next 24 hours
    let exampleTimes = [];
    for (let i = 0; i < 24; i += interval) {
      const timeHour = (startTime + i) % 24;
      exampleTimes.push(`${String(timeHour).padStart(2, '0')}:00`);
    }

    await bot.editMessageText(
      `✅ Settings updated! Notifications will be sent every ${interval} hours, starting at ${String(startTime).padStart(2, '0')}:00.\n\nExample notification times: ${exampleTimes.join(', ')}`,
      { chat_id: chatId, message_id: msg.message_id }
    );
    delete userSessions[chatId];
  } else if (data === 'logout_confirm') {
    const data = await readData();
    const user = data.users[chatId];

    if (user) {
      if (user.groups && user.groups.length > 0) {
        console.log(`User ${user.login} is logging out. Bot will leave ${user.groups.length} groups.`);
        for (const groupId of user.groups) {
          try {
            await bot.leaveChat(groupId);
            console.log(`✅ Bot left group ${groupId}`);
          } catch (err) {
            console.error(`❌ Failed to leave group ${groupId}:`, err.message);
          }
        }
      }

      delete data.users[chatId];
      await writeData(data);
      console.log(`🗑️ User data for ${chatId} has been deleted.`);
    }
    delete userSessions[chatId];

    await bot.editMessageText("Logout successful. The bot has left your groups and your data has been deleted.", { chat_id: chatId, message_id: msg.message_id });
    await bot.sendMessage(chatId, "Type /start to begin again.", {
      reply_markup: { remove_keyboard: true }
    });
  } else if (data === 'logout_cancel') {
    await bot.editMessageText("Logout cancelled. You are still logged in.", { chat_id: chatId, message_id: msg.message_id });
  }
});

// --- Group Management Logic ---

bot.on("my_chat_member", async (msg) => {
  const data = await readData();
  const userId = msg.from.id;
  const user = data.users[userId];
  const groupId = msg.chat.id;

  if (!user) {
    console.log(`Bot added to group ${groupId} by a non-registered user ${userId}. Ignoring.`);
    return;
  }

  if (msg.new_chat_member.status === "administrator") {
    if (!user.groups.includes(groupId)) {
      user.groups.push(groupId);
      await writeData(data);
      console.log(`✅ Added group ${groupId} for user ${user.login}`);
    }
  } else if (["left", "kicked"].includes(msg.new_chat_member.status)) {
    user.groups = user.groups.filter(id => id !== groupId);
    await writeData(data);
    console.log(`🗑️ Removed group ${groupId} for user ${user.login}`);
  }
});

// --- Message Sending and Scheduling ---

async function sendGroupMessage(userId, message) {
  const data = await readData();
  const user = data.users[userId];
  if (!user || user.groups.length === 0) {
    bot.sendMessage(userId, "⚠️ You have no groups to send messages to.");
    return;
  }

  bot.sendMessage(userId, `🚀 Sending your message to ${user.groups.length} group(s)...`);
  let successCount = 0;
  for (const groupId of user.groups) {
    try {
      await bot.sendMessage(groupId, message);
      successCount++;
    } catch (err) {
      console.error(`Failed to send to ${groupId}:`, err.message);
    }
  }
  bot.sendMessage(userId, `✅ Message sent to ${successCount} out of ${user.groups.length} groups.`);
}

async function checkScheduledMessages() {
  const data = await readData();
  const now = new Date();

  const tashkentOffset = 5 * 60;
  const localOffset = now.getTimezoneOffset();
  const tashkentTime = new Date(now.getTime() + (tashkentOffset + localOffset) * 60000);
  const currentTashkentHour = tashkentTime.getHours();
  const currentTashkentMinute = tashkentTime.getMinutes();

  let dataChanged = false;

  for (const userId in data.users) {
    const user = data.users[userId];
    const settings = user.notificationSettings;

    // Check if notifications should be sent based on the current hour
    // For example, if startTime is 8 and interval is 6, send at 8, 14, 20, etc.
    const hoursSinceStartTime = (24 + currentTashkentHour - settings.startTime) % 24;
    const shouldSendThisHour = hoursSinceStartTime % settings.intervalHours === 0;
    
    // Only process if it's within 5 minutes of the hour to avoid multiple sends
    if (!shouldSendThisHour || currentTashkentMinute > 5) {
      continue;
    }

    // On first run for a user, set the lastNotified time to now and wait for the next interval
    if (settings.enabled && !settings.lastNotified) {
      data.users[userId].notificationSettings.lastNotified = now.getTime();
      dataChanged = true;
      continue;
    }
    
    if (!settings.enabled || !settings.lastNotified) continue;

    // Check if enough time has passed since the last notification
    const intervalMillis = settings.intervalHours * 60 * 60 * 1000;
    if (now.getTime() - settings.lastNotified >= intervalMillis) {
      console.log(`🔔 Sending scheduled message for user ${user.login} (Tashkent Time: ${currentTashkentHour}:${currentTashkentMinute})`);
      await sendGroupMessage(userId, settings.defaultMessage);
      data.users[userId].notificationSettings.lastNotified = now.getTime();
      dataChanged = true;
    }
  }

  if (dataChanged) {
    await writeData(data);
  }
}

// Run scheduler every 5 minutes
setInterval(checkScheduledMessages, 5 * 60 * 1000);

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('🛑 Bot is shutting down...');
  bot.stopPolling();
  process.exit(0);
});