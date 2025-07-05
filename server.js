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
      [{ text: "👤 My Profile" }, { text: "👥 My Groups" }],
      [{ text: "🔒 Logout" }]
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
  
  if (text === '👥 My Groups') {
    const data = await readData();
    const user = data.users[chatId];
    if (!user) {
      return bot.sendMessage(chatId, "You don't seem to be logged in. Type /start");
    }
    
    if (user.groups.length === 0) {
      return bot.sendMessage(chatId, "You haven't added this bot to any groups yet. Add the bot as an admin to your groups.");
    }
    
    // Send a "loading" message since getting group info might take time
    const loadingMsg = await bot.sendMessage(chatId, "🔄 *Loading your groups...*", { parse_mode: 'Markdown' });
    
    // Build a keyboard with group names and delete buttons
    const groupKeyboard = {
      inline_keyboard: []
    };
    
    for (const groupId of user.groups) {
      try {
        const chatInfo = await bot.getChat(groupId);
        const chatName = chatInfo.title || chatInfo.username || `Group ${groupId}`;
        groupKeyboard.inline_keyboard.push([
          { text: chatName, callback_data: `group_info_${groupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${groupId}` }
        ]);
      } catch (err) {
        console.error(`Failed to get info for group ${groupId}:`, err.message);
        groupKeyboard.inline_keyboard.push([
          { text: `Unknown Group (${groupId})`, callback_data: `group_info_${groupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${groupId}` }
        ]);
      }
    }
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    return bot.sendMessage(chatId, "👥 *Your Groups*\nSelect a group to see details or remove it:", {
      parse_mode: 'Markdown',
      reply_markup: groupKeyboard
    });
  }
  
  if (text === '👤 My Profile') {
    const data = await readData();
    const user = data.users[chatId];
    if (user) {
      const settings = user.notificationSettings;
      
      const profileText = `
👤 *Your Profile*
*Login:* \`${user.login}\`
*Groups Managed:* ${user.groups.length}
*Notification Schedule:* Every ${settings.intervalHours} hours, starting at ${String(settings.startTime).padStart(2, '0')}:00
*Default Message:* "${settings.defaultMessage}"
      `;
      
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
  } else if (data.startsWith('group_info_')) {
    // When user taps on a group name, show more details
    const groupId = data.split('group_info_')[1];
    try {
      const chatInfo = await bot.getChat(groupId);
      const membersCount = await bot.getChatMemberCount(groupId);
      const groupDetails = `
📊 *Group Details*
*Name:* ${chatInfo.title || 'Unnamed'}
*Username:* ${chatInfo.username ? '@' + chatInfo.username : 'None'}
*Members:* ${membersCount}
*Group ID:* \`${groupId}\`
      `;
      await bot.editMessageText(groupDetails, {
        chat_id: chatId,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "◀️ Back to Groups", callback_data: "back_to_groups" }],
            [{ text: "❌ Remove This Group", callback_data: `remove_group_${groupId}` }]
          ]
        }
      });
    } catch (err) {
      console.error(`Error getting group info: ${err.message}`);
      await bot.editMessageText("Error retrieving group information.", {
        chat_id: chatId,
        message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "◀️ Back to Groups", callback_data: "back_to_groups" }],
            [{ text: "❌ Remove This Group", callback_data: `remove_group_${groupId}` }]
          ]
        }
      });
    }
  } else if (data === 'back_to_groups') {
    // Refresh the groups list when going back
    const userData = await readData();
    const user = userData.users[chatId];
    
    if (!user || user.groups.length === 0) {
      await bot.editMessageText("You don't have any groups.", {
        chat_id: chatId, 
        message_id: msg.message_id
      });
      return;
    }
    
    const groupKeyboard = {
      inline_keyboard: []
    };
    
    for (const groupId of user.groups) {
      try {
        const chatInfo = await bot.getChat(groupId);
        const chatName = chatInfo.title || chatInfo.username || `Group ${groupId}`;
        groupKeyboard.inline_keyboard.push([
          { text: chatName, callback_data: `group_info_${groupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${groupId}` }
        ]);
      } catch (err) {
        groupKeyboard.inline_keyboard.push([
          { text: `Unknown Group (${groupId})`, callback_data: `group_info_${groupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${groupId}` }
        ]);
      }
    }
    
    await bot.editMessageText("👥 *Your Groups*\nSelect a group to see details or remove it:", {
      chat_id: chatId,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: groupKeyboard
    });
  } else if (data.startsWith('remove_group_')) {
    const groupId = data.split('remove_group_')[1];
    
    // Show confirmation dialog before removing
    await bot.editMessageText(
      "⚠️ *Are you sure you want to remove this group?*\n\nThe bot will leave the group and it will be removed from your list.",
      {
        chat_id: chatId,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Yes, Remove", callback_data: `confirm_remove_group_${groupId}` },
              { text: "❌ No, Cancel", callback_data: "back_to_groups" }
            ]
          ]
        }
      }
    );
  }    else if (data.startsWith('confirm_remove_group_')) {
    const groupIdToRemove = parseInt(data.split('confirm_remove_group_')[1], 10);
    let appData = await readData();
    const user = appData.users[chatId];
    
    if (!user) return;
    
    // Try to leave the group
    try {
      await bot.leaveChat(groupIdToRemove);
      console.log(`✅ Bot left group ${groupIdToRemove}`);
    } catch (err) {
      console.error(`❌ Failed to leave group ${groupIdToRemove}:`, err.message);
      // Continue with removal even if leaving fails
    }
    
    // Remove the group from user's data by comparing numbers
    user.groups = user.groups.filter(id => id !== groupIdToRemove);
    await writeData(appData);
    console.log(`Group ${groupIdToRemove} removed from user ${user.login}'s data`);
    
    // Show a temporary success message
    await bot.editMessageText("✅ Group removed successfully. Refreshing group list...", {
       chat_id: chatId,
      message_id: msg.message_id
    });
    
    // Re-read the data to ensure we have the latest state
    appData = await readData();
    const updatedUser = appData.users[chatId];
    
    // Handle case where user has no groups left
    if (!updatedUser || updatedUser.groups.length === 0) {
      await bot.editMessageText("You have no groups left. Add this bot as admin to groups to manage them.", {
        chat_id: chatId,
        message_id: msg.message_id
      });
      return;
    }
    
    // Build an updated keyboard with the refreshed group list
    const groupKeyboard = {
      inline_keyboard: []
    };
    
    for (const remainingGroupId of updatedUser.groups) {
      try {
        const chatInfo = await bot.getChat(remainingGroupId);
        const chatName = chatInfo.title || chatInfo.username || `Group ${remainingGroupId}`;
        groupKeyboard.inline_keyboard.push([
          { text: chatName, callback_data: `group_info_${remainingGroupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${remainingGroupId}` }
        ]);
      } catch (err) {
        console.error(`Failed to get info for group ${remainingGroupId}:`, err.message);
        groupKeyboard.inline_keyboard.push([
          { text: `Unknown Group (${remainingGroupId})`, callback_data: `group_info_${remainingGroupId}` },
          { text: "❌ Remove", callback_data: `remove_group_${remainingGroupId}` }
        ]);
      }
    }
    
    // Show the updated groups list
    await bot.editMessageText("👥 *Your Groups*\nGroup removed successfully! Here are your remaining groups:", {
      chat_id: chatId,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: groupKeyboard
    });
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
  const chatInfo = msg.chat; // Get chat info from the update itself

  if (!user) {
    console.log(`Bot added to group ${groupId} by a non-registered user ${userId}. Ignoring.`);
    return;
  }

  const chatName = chatInfo.title || `Group ID ${groupId}`;

  if (msg.new_chat_member.status === "administrator") {
    if (!user.groups.includes(groupId)) {
      user.groups.push(groupId);
      await writeData(data);
      console.log(`✅ Added group ${groupId} for user ${user.login}`);
      // Notify the user that the group was added successfully
      bot.sendMessage(userId, `✅ Success! The bot has been added to the group "${chatName}" and it's now linked to your account.`);
    }
  } else if (msg.new_chat_member.status === "member") {
      // Inform the user that the bot needs admin rights
      bot.sendMessage(userId, `⚠️ The bot was added to "${chatName}", but it needs to be an administrator to function correctly. Please promote it to an admin.`);
  } else if (["left", "kicked"].includes(msg.new_chat_member.status)) {
    // Check if the group was actually in the user's list before removing
    if (user.groups.includes(groupId)) {
        user.groups = user.groups.filter(id => id !== groupId);
        await writeData(data);
        console.log(`🗑️ Removed group ${groupId} for user ${user.login}`);
        // Notify the user that the group has been unlinked
        bot.sendMessage(userId, `ℹ️ The bot has been removed from the group "${chatName}" and it has been unlinked from your account.`);
    }
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

    if (!settings.enabled) continue;

    // This is the primary check: has enough time passed since the last send?
    const intervalMillis = settings.intervalHours * 60 * 60 * 1000;
    const lastNotifiedTime = settings.lastNotified ? new Date(settings.lastNotified).getTime() : 0;

    if (now.getTime() - lastNotifiedTime < intervalMillis) {
      continue; // Not enough time has passed, skip.
    }

    // This is the secondary check: is it the correct hour based on the schedule?
    // This prevents drift if the bot was offline.
    const hoursSinceStart = (now.getTime() - new Date(settings.startTime).getTime()) / (1000 * 60 * 60);
    const shouldSendThisHour = Math.round(hoursSinceStart) % settings.intervalHours === 0;

    // Only process if it's the correct hour and within the first 5 minutes to avoid multiple sends.
    if (!shouldSendThisHour || currentTashkentMinute > 5) {
      // If enough time has passed but it's not the scheduled hour, we likely missed a notification.
      // We will wait for the next correct hour.
      continue;
    }

    console.log(`🔔 Sending scheduled message for user ${user.login} (Tashkent Time: ${currentTashkentHour}:${String(currentTashkentMinute).padStart(2, '0')})`);
    await sendGroupMessage(userId, settings.defaultMessage);
    data.users[userId].notificationSettings.lastNotified = now.getTime();
    dataChanged = true;
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