import pg from 'pg';
import {readConfig} from './config.mjs';
import {Store} from './store.mjs';
import {buildApp} from './app.mjs';
import {TelegramBot,runReminders} from './bot.mjs';

export async function start(config,pool) {
  const store=new Store(pool);await store.migrate();
  const bot=new TelegramBot(config.botToken,config.baseUrl);
  const app=await buildApp({config,store,bot,logger:true});
  await app.listen({port:config.port,host:config.host});
  let working=false,ticks=0;
  const tick=async()=>{
    if(working)return;working=true;
    try { if(config.reminders&&!config.devAuth) await runReminders(store,bot);if(ticks++%60===0)await store.cleanup(); }
    catch { app.log.error('Background maintenance failed; retrying on next tick'); }
    finally{working=false}
  };
  const interval=setInterval(tick,60000);interval.unref();
  await tick();
  if(!config.devAuth){
    try {
      const me=await bot.call('getMe');app.botUsername=me.username;
      if(config.autoConfigureBot){await bot.setup(config.webhookSecret);app.log.info('Telegram webhook and menu configured');}
    }catch{app.log.error('Telegram setup failed. Check BOT_TOKEN / APP_URL and run npm run bot:setup after deployment.');}
  }
  const stop=async()=>{clearInterval(interval);await app.close();await store.close();process.exit(0)};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  return app;
}
if(import.meta.url===new URL(process.argv[1],'file:').href){
  try {
    const config=readConfig();
    const pool=new pg.Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:10000,
      ...(config.dbSsl?{ssl:{rejectUnauthorized:true}}:{})});
    pool.on('error',()=>console.error('PostgreSQL connection error'));
    await start(config,pool);
  }catch(error){console.error('Server startup failed:',error.code||error.message);process.exit(1)}
}
