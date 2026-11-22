import {readConfig} from './config.mjs';
import {localPool} from './local-db.mjs';
import {start} from './index.mjs';
if(process.env.RENDER || process.env.NODE_ENV==='production') throw new Error('Local development server cannot run in production');
const config=readConfig({...process.env,NODE_ENV:'development',DEV_AUTH:'true',DATABASE_URL:'local',
  APP_URL:`http://127.0.0.1:${process.env.PORT||3000}`,HOST:'127.0.0.1',AUTO_CONFIGURE_BOT:'false',ENABLE_REMINDERS:'false'});
await start(config,await localPool(process.env.LOCAL_DATABASE_DIR||'.localdb'));
