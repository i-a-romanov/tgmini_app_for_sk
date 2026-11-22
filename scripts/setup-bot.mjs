import {readConfig} from '../server/config.mjs';
import {TelegramBot} from '../server/bot.mjs';
try {
  const config=readConfig();
  if(!config.baseUrl.startsWith('https:')) throw new Error('A public HTTPS APP_URL is required');
  const bot=new TelegramBot(config.botToken,config.baseUrl);
  const username=await bot.setup(config.webhookSecret);
  console.log(`Bot configured: https://t.me/${username}\nMini App URL: ${config.baseUrl}`);
} catch(error) { console.error('Bot setup failed:',error.message);process.exit(1); }
