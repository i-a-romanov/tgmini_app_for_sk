import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { localPool } from '../server/local-db.mjs';
import { Store } from '../server/store.mjs';
import { buildApp } from '../server/app.mjs';

const origin='http://127.0.0.1:4197',botToken='123456:e2e-synthetic-token';
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:99887766,first_name:'Маша',allows_write_to_pm:true})};
const check=Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('\n');
const secret=createHmac('sha256','WebAppData').update(botToken).digest();
const initData=new URLSearchParams({...fields,hash:createHmac('sha256',secret).update(check).digest('hex')}).toString();
const config={production:false,devAuth:false,baseUrl:origin,botToken,webhookSecret:'b'.repeat(64),reminders:true,pilot:true,operatorName:'Test',supportUrl:''};
const store=new Store(await localPool());await store.migrate();
const app=await buildApp({config,store,bot:{send:async()=>{}}});app.botUsername='SkFastTrackTestBot';
let browser,page;
try{
 await app.listen({port:4197,host:'127.0.0.1'});
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)});
 // Real HTTP + DB + signed authentication; only Telegram's host bridge is simulated.
 const bridge=`(()=>{
  let main,back;const events={};
  const MainButton={setParams(p){Object.assign(this,p)},onClick(f){main=f},showProgress(){this.progress=true},hideProgress(){this.progress=false},hide(){this.is_visible=false}};
  const BackButton={show(){this.visible=true},hide(){this.visible=false},onClick(f){back=f}};
  window.Telegram={WebApp:{initData:${JSON.stringify(initData)},colorScheme:'light',themeParams:{},MainButton,BackButton,
   SettingsButton:{show(){}},HapticFeedback:{notificationOccurred(){}},ready(){},expand(){},isVersionAtLeast(){return true},setHeaderColor(){},setBackgroundColor(){},enableClosingConfirmation(){},disableClosingConfirmation(){},
   onEvent(n,f){events[n]=f},openTelegramLink(url){window.__sharedLink=url},downloadFile(file){const a=document.createElement('a');a.href=file.url;a.download=file.file_name;a.click()},showConfirm(t,cb){cb(true)},requestWriteAccess(cb){cb(false)}}};
  window.__tgTest={clickMain(){if(MainButton.is_active)main()},back(){back()},MainButton,theme(value){window.Telegram.WebApp.colorScheme=value;events.themeChanged?.()}};
 })();`;
 new Function(bridge); // Parse the host simulation before starting browser assertions.
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'application/javascript',body:bridge}));
 const main=async()=>{await page.waitForFunction(()=>window.__tgTest.MainButton.is_active&&!window.__tgTest.MainButton.progress);await page.evaluate(()=>window.__tgTest.clickMain())};
 await page.goto(origin);await page.getByRole('heading',{name:/Большая цель/}).waitFor();
 assert.equal(await page.locator('.web-header').isVisible(),false);
 assert.equal(await page.locator('#action-bar').isVisible(),false);
 await main();await page.getByRole('heading',{name:'С чего начнём?'}).waitFor();
 await main();await page.locator('#reminders').waitFor();
 await page.locator('#reminders').check();await page.locator('#reminder-time').fill('18:30');
 await page.locator('#timezone').selectOption('Europe/Moscow');await main();
 await page.getByRole('heading',{name:/Ваш план на хороший старт/}).waitFor();
 assert.match(await page.locator('main').innerText(),/18:30/);
 await main();await page.getByRole('heading',{name:/У вас есть план/}).waitFor();
 await main();await page.locator('[data-answer="1"]').click();await main();
 await page.getByRole('status').filter({hasText:'Попробуйте ещё раз'}).waitFor();
 await page.locator('[data-answer="0"]').click();await main();await page.locator('.success-feedback').waitFor();
 await main();await page.locator('.readiness').waitFor();assert.match(await page.locator('.readiness').innerText(),/1 из 16/);
 await main();await page.locator('#task-note').fill('Хочу развить навыки управления командой и применять их в образовательных проектах.');
 await page.locator('#save-draft').click();await page.getByText('Черновик сохранён',{exact:true}).waitFor();
 await page.reload();await page.locator('.readiness').waitFor();await main();
 assert.match(await page.locator('#task-note').inputValue(),/управления командой/);await main();await page.locator('.success-feedback').waitFor();await main();
 assert.match(await page.locator('.readiness').innerText(),/2 из 16/);
 await page.locator('[data-nav="deadlines"]').first().click();await page.getByRole('heading',{name:'Важные даты'}).waitFor();await main();
 await page.locator('#deadline-title').fill('Проверить комплект документов');
 const future=new Date(Date.now()+172800000);const value=new Date(future.getTime()-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
 await page.locator('#deadline-date').fill(value);await main();await page.getByRole('heading',{name:'Проверить комплект документов'}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-calendar]').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'sk-deadline.ics');
 await page.locator('[data-deadline-done]').click();await page.getByText('Выполнено',{exact:true}).waitFor();
 await page.evaluate(()=>window.__tgTest.back());await page.evaluate(()=>window.__tgTest.back());
 // Explicitly reach home through the task stack if returning through the creation screen.
 await page.reload();await page.locator('.readiness').waitFor();
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/live-home-light.png',fullPage:true});
 await page.evaluate(()=>window.__tgTest.theme('dark'));assert.equal(await page.locator('body').getAttribute('data-theme'),'dark');
 await page.screenshot({path:'test-results/live-home-dark.png',fullPage:true});
 await page.setViewportSize({width:320,height:700});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('.avatar').click();await page.getByRole('heading',{name:'Маша',exact:true}).waitFor();
 await page.locator('#share').click();assert.match(await page.evaluate(()=>window.__sharedLink),/^https:\/\/t.me\/share\/url\?/);
 await page.getByRole('button',{name:'Мои данные'}).click();await page.getByRole('button',{name:'Удалить мой профиль'}).click();
 await page.locator('#delete-confirm').fill('УДАЛИТЬ');await main();await page.getByRole('heading',{name:'Профиль удалён'}).waitFor();
 await page.reload();await page.getByRole('heading',{name:/Большая цель/}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: Telegram bridge flow, signed auth, real SQL, onboarding, task retry/completion, draft reload, personal deadlines, calendar, themes, 320px, sharing, account deletion.');
}catch(error){console.error('Visible page on failure:',await page?.locator('body').innerText());throw error}
finally{await browser?.close();await app.close();await store.close()}
