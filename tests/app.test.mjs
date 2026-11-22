import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { localPool } from '../server/local-db.mjs';
import { Store } from '../server/store.mjs';
import { buildApp } from '../server/app.mjs';
import { readConfig } from '../server/config.mjs';
import { reminderWindow,runReminders } from '../server/bot.mjs';

const botToken='123456:only-synthetic-test-token';
const config={production:true,devAuth:false,baseUrl:'https://example.test',botToken,webhookSecret:'a'.repeat(64),reminders:true,pilot:true,operatorName:'Test',supportUrl:''};
let store,app,pool,deliveryCount=0;
const bot={send:async()=>{deliveryCount++}};
function sign(id,extra={}){
 const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'<Test & User>',...extra})};
 const check=Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('\n');
 const key=createHmac('sha256','WebAppData').update(botToken).digest();
 return new URLSearchParams({...fields,hash:createHmac('sha256',key).update(check).digest('hex')}).toString();
}
async function login(id,extra={}){
 const res=await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin:config.baseUrl},payload:{initData:sign(id,extra)}});
 assert.equal(res.statusCode,200,res.body);return res.json();
}
async function request(session,method,url,payload){return app.inject({method,url,payload,headers:{origin:config.baseUrl,authorization:`Bearer ${session.accessToken}`,'x-csrf-token':session.csrfToken}})}
async function prefs(session,overrides={}){
 const current=(await request(session,'GET','/api/me')).json();
 const {goal,pace,timezone,time,reminders,version}=current.profile;
 return request(session,'PUT','/api/preferences',{goal,pace,timezone,time,reminders,version,...overrides});
}
before(async()=>{pool=await localPool();store=new Store(pool);await store.migrate();app=await buildApp({config,store,bot})});
after(async()=>{await app.close();await store.close()});

test('health and assets serve without exposing project files',async()=>{
 assert.equal((await app.inject('/healthz')).statusCode,200);
 assert.match((await app.inject('/')).body,/telegram-web-app/);
 assert.equal((await app.inject('/server/config.mjs')).statusCode,404);
 assert.equal((await app.inject('/.env')).statusCode,404);
 assert.equal((await app.inject('/api/me')).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/dev',headers:{origin:config.baseUrl}})).statusCode,404);
});
test('rejects tampered launch and wrong origin; authenticates signed launch',async()=>{
 const raw=sign(101).replace('101','102');
 assert.equal((await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin:config.baseUrl},payload:{initData:raw}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin:'https://evil.test'},payload:{initData:sign(101)}})).statusCode,403);
 const s=await login(101);assert.equal(s.summary.completed,0);assert.equal(s.summary.total,16);assert.equal(s.profile.active,false);
 assert.equal(s.content.tasks[0].correct,undefined);
});
test('mutations require CSRF even with a valid session',async()=>{
 const s=await login(102);
 const res=await app.inject({method:'POST',url:'/api/activate',headers:{origin:config.baseUrl,authorization:`Bearer ${s.accessToken}`}});
 assert.equal(res.statusCode,403);
});
test('onboarding persists across sessions, stale writes conflict, inputs validate',async()=>{
 const s=await login(103);assert.equal((await prefs(s,{goal:'program',pace:25})).statusCode,200);
 assert.equal((await request(s,'PUT','/api/preferences',{goal:'grant',pace:15,timezone:'Europe/Moscow',time:'19:00',reminders:false,version:1})).statusCode,409);
 assert.equal((await prefs(s,{timezone:'Not/A/Zone'})).statusCode,400);
 assert.equal((await prefs(s,{time:'30:00'})).statusCode,400);
 assert.equal((await prefs(s,{reminders:true})).statusCode,409);
 const reload=await login(103);assert.equal(reload.profile.goal,'program');assert.equal(reload.profile.pace,25);assert.equal(reload.summary.total,6);
});
test('activation and completion are idempotent; wrong quiz does not complete',async()=>{
 const s=await login(104);
 assert.equal((await request(s,'PUT','/api/tasks/evidence',{answer:{choice:0},complete:true})).statusCode,409);
 await request(s,'POST','/api/activate');await request(s,'POST','/api/activate');
 const wrong=await request(s,'PUT','/api/tasks/evidence',{answer:{choice:1},complete:true});assert.equal(wrong.json().correct,false);
 assert.equal((await request(s,'GET','/api/me')).json().summary.completed,0);
 for(let i=0;i<2;i++)assert.equal((await request(s,'PUT','/api/tasks/evidence',{answer:{choice:0},complete:true})).statusCode,200);
 assert.equal((await request(s,'GET','/api/me')).json().summary.completed,1);
 assert.equal((await request(s,'PUT','/api/tasks/motivation',{answer:{note:'tiny'},complete:true})).statusCode,400);
 assert.equal((await request(s,'PUT','/api/tasks/motivation',{answer:{note:'draft'},complete:false})).statusCode,200);
 assert.equal((await login(104)).progress.find(x=>x.taskId==='motivation').answer.note,'draft');
});
test('task checklist requires all checks and only assigned tasks are writable',async()=>{
 const s=await login(105);await request(s,'POST','/api/activate');
 assert.equal((await request(s,'PUT','/api/tasks/rules',{answer:{checked:[0]},complete:true})).statusCode,400);
 assert.equal((await request(s,'PUT','/api/tasks/rules',{answer:{checked:[0,1,2,3]},complete:true})).statusCode,200);
 await prefs(s,{goal:'program'});
 assert.equal((await request(s,'PUT','/api/tasks/essay-draft',{answer:{note:'A long enough draft response'},complete:true})).statusCode,404);
});
test('deadlines enforce ownership and validate dates',async()=>{
 const a=await login(106),b=await login(107);
 const created=await request(a,'POST','/api/deadlines',{title:'My private deadline',dueAt:new Date(Date.now()+86400000).toISOString()});
 assert.equal(created.statusCode,200);const id=created.json().deadlines[0].id;
 assert.equal((await request(b,'GET','/api/me')).json().deadlines.length,0);
 assert.equal((await request(b,'DELETE',`/api/deadlines/${id}`)).statusCode,404);
 assert.equal((await request(b,'PATCH',`/api/deadlines/${id}`,{done:true})).statusCode,404);
 assert.equal((await request(a,'PATCH',`/api/deadlines/${id}`,{done:true})).json().deadlines[0].done,true);
 assert.equal((await request(a,'POST','/api/deadlines',{title:'Past',dueAt:'2000-01-01T00:00:00Z'})).statusCode,400);
 assert.equal((await request(a,'DELETE',`/api/deadlines/${id}`)).statusCode,200);
});
test('webhook validates secret, deduplicates /start and remembers pre-login permission',async()=>{
 const payload={update_id:201,message:{from:{id:108},chat:{id:108,type:'private'},text:'/start'}};
 assert.equal((await app.inject({method:'POST',url:'/api/bot/webhook',payload})).statusCode,403);
 const send=()=>app.inject({method:'POST',url:'/api/bot/webhook',headers:{'x-telegram-bot-api-secret-token':config.webhookSecret},payload});
 const count=deliveryCount;await send();await send();assert.equal(deliveryCount,count+1);
 const s=await login(108);assert.equal(s.profile.canMessage,true);
 assert.equal((await prefs(s,{reminders:true})).statusCode,200);
});
test('calendar export uses short-lived, owner-authorized links and ends on deletion',async()=>{
 const a=await login(120),b=await login(121);
 const added=(await request(a,'POST','/api/deadlines',{title:'Собрать документы, проверить; отправить',dueAt:new Date(Date.now()+86400000).toISOString()})).json();
 const id=added.deadlines[0].id;
 assert.equal((await request(b,'POST',`/api/deadlines/${id}/export`)).statusCode,404);
 const exported=await request(a,'POST',`/api/deadlines/${id}/export`);assert.equal(exported.statusCode,200);
 const path=new URL(exported.json().url).pathname;
 const file=await app.inject(path);assert.equal(file.statusCode,200);assert.match(file.body,/BEGIN:VCALENDAR/);assert.match(file.body,/\\,/);
 assert.match(file.headers['content-disposition'],/attachment/);
 await pool.query("UPDATE sk_downloads SET expires_at=now()-interval '1 minute'");
 assert.equal((await app.inject(path)).statusCode,404);
 const fresh=(await request(a,'POST',`/api/deadlines/${id}/export`)).json();
 await request(a,'DELETE','/api/me',{confirmation:'DELETE'});
 assert.equal((await app.inject(new URL(fresh.url).pathname)).statusCode,404);
});
test('reminders deduplicate and /stop prevents future deliveries',async()=>{
 const s=await login(109,{allows_write_to_pm:true});await request(s,'POST','/api/activate');
 await prefs(s,{reminders:true,time:'19:00',timezone:'Europe/Moscow'});
 const date=new Date('2026-12-01T16:05:00Z'),count=deliveryCount;
 await runReminders(store,bot,date);await runReminders(store,bot,date);assert.equal(deliveryCount,count+1);
 await app.inject({method:'POST',url:'/api/bot/webhook',headers:{'x-telegram-bot-api-secret-token':config.webhookSecret},payload:{update_id:202,message:{from:{id:109},chat:{id:109,type:'private'},text:'/stop'}}});
 assert.equal((await request(s,'GET','/api/me')).json().profile.reminders,false);
 const stopped=deliveryCount;await runReminders(store,bot,new Date('2026-12-02T16:05:00Z'));assert.equal(deliveryCount,stopped);
});
test('reminder timezone handles a date boundary and skips late catch-up',()=>{
 const u={timezone:'Asia/Kamchatka',reminder_time:'00:10'};
 assert.equal(reminderWindow(u,new Date('2026-12-01T12:15:00Z')),'2026-12-02');
 assert.equal(reminderWindow(u,new Date('2026-12-01T13:00:00Z')),null);
});
test('deletion cascades private data, invalidates all sessions, reentry starts fresh',async()=>{
 const s=await login(110),other=await login(110);await request(s,'POST','/api/activate');
 await request(s,'PUT','/api/tasks/evidence',{answer:{choice:0},complete:true});
 await request(s,'POST','/api/deadlines',{title:'Delete me',dueAt:new Date(Date.now()+86400000).toISOString()});
 assert.equal((await request(s,'DELETE','/api/me',{confirmation:'WRONG'})).statusCode,400);
 assert.equal((await request(s,'DELETE','/api/me',{confirmation:'DELETE'})).statusCode,200);
 assert.equal((await request(other,'GET','/api/me')).statusCode,401);
 const fresh=await login(110);assert.equal(fresh.profile.active,false);assert.equal(fresh.progress.length,0);assert.equal(fresh.deadlines.length,0);
});
test('security configuration rejects development auth on Render; generated secrets normalize',()=>{
 assert.throws(()=>readConfig({RENDER:'true',DEV_AUTH:'true',DATABASE_URL:'local'}),/forbidden/);
 assert.throws(()=>readConfig({NODE_ENV:'production',DEV_AUTH:'true'}),/forbidden/);
 const c=readConfig({NODE_ENV:'production',DATABASE_URL:'postgres://test',BOT_TOKEN:'test',WEBHOOK_SECRET:'a'.repeat(42)+'=',RENDER_EXTERNAL_URL:'https://app.onrender.com'});
 assert.match(c.webhookSecret,/^[a-f0-9]{64}$/);
});
