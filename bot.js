require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require('fs').promises;
const { execSync } = require('child_process');

const DATA_FILE = './group_ids.json';
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });


const WINDOW = 5 * 60 * 1000; 
console.log("🤖 Polling for group joins (300s)…");

async function getGroupIds() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data).group_ids || [];
  } catch (err) {
    console.log("No existing data file, will create one");
    return [];
  }
}

async function addGroupId(newId) {
  console.log(`📥 Processing group ID ${newId}…`);
  const existing = await getGroupIds();
  
  if (!existing.includes(newId)) {
    const updated = [...existing, newId];
    await fs.writeFile(DATA_FILE, JSON.stringify({ group_ids: updated }, null, 2));
    console.log(`✅ Successfully added ${newId}`);
    
    try {
      execSync('git config --global user.name "GitHub Actions Bot"');
      execSync('git config --global user.email "actions@github.com"');
      
      try {
        execSync('git pull --rebase');
      } catch (pullError) {
        console.log("⚠️ Pull failed, continuing anyway:", pullError.message);
      }
      
      execSync('git add group_ids.json');
      execSync('git commit -m "Add new group ID"');
      execSync('git push');
      console.log("✅ Changes pushed to repository");
    } catch (gitError) {
      console.error("⚠️ Git operation failed:", gitError.message);
      console.log("The group ID was saved locally but not pushed to repository");
    }
    
    return true; 
  } else {
    console.log(`ℹ️ ${newId} already present, skipping.`);
    return false; 
  }
}

bot.on("my_chat_member", async (msg) => {
  const chatId = msg.chat?.id;
  const status = msg.new_chat_member?.status;
  if (status === "administrator" && chatId) {
    const isNewGroup = await addGroupId(chatId);
    if (isNewGroup) {
      await bot.sendMessage(chatId, "✅ Bot added! You'll get updates every 2 hours.");
    }
  }
});

setTimeout(() => {
  console.log("🛑 Poll window ended—exiting.");
  process.exit(0);
}, WINDOW);