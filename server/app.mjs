import Fastify, { LogController } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { validateInitData } from './auth.mjs';
import { goals, tasks, planTasks, publicContent } from './content.mjs';
import { safeEqual, handleBotUpdate } from './bot.mjs';
import { calendarFile } from './calendar.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const csrf = token => digest(`csrf:${token}`);
const object = (properties, required=Object.keys(properties)) => ({type:'object',additionalProperties:false,properties,required});
const text = (maxLength=200,minLength=1) => ({type:'string',minLength,maxLength});
function httpError(code, message) { return Object.assign(new Error(message), {statusCode:code}); }
function validTimezone(tz) { try { new Intl.DateTimeFormat('ru',{timeZone:tz}).format(); return true; } catch { return false; } }

export async function buildApp({ config, store, bot, logger = false }) {
  const app = Fastify({logger,logController:new LogController({disableRequestLogging:true}),trustProxy:config.production?1:false,bodyLimit:32768,
    ajv:{customOptions:{removeAdditional:false}}});
  await app.register(cookie);
  await app.register(rateLimit,{max:300,timeWindow:'1 minute'});
  const cookieName = config.production ? '__Host-sk_session' : 'sk_session';
  app.decorateRequest('viewer',null);
  app.decorateRequest('sessionToken',null);
  app.addHook('onRequest',async (req,reply) => {
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Referrer-Policy','no-referrer');
    reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org; base-uri 'none'; form-action 'self'; object-src 'none'");
    if (config.production) reply.header('Strict-Transport-Security','max-age=31536000');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control','no-store');
  });
  const publicPaths = new Set(['/api/config','/api/auth/telegram','/api/auth/dev','/api/bot/webhook']);
  app.addHook('preHandler',async (req,reply) => {
    const pathname = req.url.split('?')[0];
    if (!pathname.startsWith('/api/')) return;
    if (pathname !== '/api/bot/webhook' && !['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin !== config.baseUrl)
      throw httpError(403,'Недопустимый источник запроса');
    if (publicPaths.has(pathname)) return;
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : req.cookies[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw httpError(401,'Откройте приложение заново из Telegram');
    const user = await store.session(digest(token));
    if (!user) throw httpError(401,'Сессия закончилась. Откройте приложение заново');
    req.viewer = user; req.sessionToken = token;
    if (!['GET','HEAD'].includes(req.method) && !safeEqual(req.headers['x-csrf-token'],csrf(token))) throw httpError(403,'Обновите приложение и повторите действие');
  });
  app.setErrorHandler((error,req,reply) => {
    const status = error.validation ? 400 : error.statusCode || 500;
    if (status >= 500) app.log.error({requestId:req.id,code:error.code||'INTERNAL'},'Request failed');
    reply.code(status).send({error:{code:status===401?'UNAUTHORIZED':status===409?'CONFLICT':status===400?'VALIDATION':'REQUEST_FAILED',
      message:status>=500?'Не удалось выполнить действие. Попробуйте ещё раз.':error.validation?'Проверьте заполненные поля':error.message,requestId:req.id}});
  });
  async function responseState(id) {
    const snapshot = await store.snapshot(id);
    if (!snapshot) throw httpError(401,'Профиль удалён. Откройте приложение заново');
    const {user,progress,deadlines}=snapshot;
    const ids=planTasks(user.goal), completed=progress.filter(p=>p.completed_at&&ids.includes(p.task_id)).length;
    return { profile:{name:user.first_name,goal:user.goal,pace:user.pace,timezone:user.timezone,time:user.reminder_time,
      reminders:user.reminders,canMessage:user.can_message,active:!!user.activated_at,version:user.version},
      progress:progress.map(p=>({taskId:p.task_id,answer:p.answer,completed:!!p.completed_at})),
      summary:{completed,total:ids.length,percent:Math.round(completed/ids.length*100)},
      deadlines:deadlines.map(d=>({id:d.id,title:d.title,dueAt:d.due_at,done:d.done})) };
  }
  async function login(identity,reply) {
    const token=randomBytes(32).toString('hex');
    const user=await store.login(identity,digest(token));
    reply.setCookie(cookieName,token,{path:'/',httpOnly:true,secure:config.production,sameSite:config.production?'none':'lax',maxAge:86400});
    return { ...await responseState(user.id),accessToken:token,csrfToken:csrf(token),content:publicContent() };
  }
  app.get('/healthz',async()=>{await store.health();return {ok:true}});
  app.get('/api/config',async()=>({devAuth:config.devAuth,pilot:config.pilot,remindersAvailable:config.reminders,
    operatorName:config.operatorName,supportUrl:config.supportUrl,botUsername:app.botUsername||null}));
  app.post('/api/auth/telegram',{config:{rateLimit:{max:30,timeWindow:'1 minute'}},schema:{body:object({initData:text(16384)})}},async(req,reply)=>{
    let identity;
    try {
      identity=validateInitData(req.body.initData,config.botToken);
      const signedUser=JSON.parse(new URLSearchParams(req.body.initData).get('user'));
      identity.canMessage=signedUser.allows_write_to_pm===true;
    } catch { throw httpError(401,'Ссылка устарела. Закройте и снова откройте приложение в Telegram'); }
    return login(identity,reply);
  });
  if(config.devAuth) app.post('/api/auth/dev',async(req,reply)=>login({telegramId:'100001',firstName:'Локальный пользователь',canMessage:false},reply));
  app.get('/api/me',async req=>({...await responseState(req.viewer.id),csrfToken:csrf(req.sessionToken),content:publicContent()}));
  const preferences=object({goal:{enum:goals.map(g=>g.id)},pace:{type:'integer',enum:[10,15,25]},timezone:text(80),
    time:{type:'string',pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'},reminders:{type:'boolean'},version:{type:'integer',minimum:1}});
  app.put('/api/preferences',{schema:{body:preferences}},async req=>{
    if(!validTimezone(req.body.timezone)) throw httpError(400,'Выберите корректный часовой пояс');
    if(req.body.reminders && !config.reminders) throw httpError(400,'Напоминания отключены на сервере');
    if(req.body.reminders && !req.viewer.can_message) throw httpError(409,'Сначала разрешите боту отправлять сообщения');
    if(!await store.updatePreferences(req.viewer.id,req.body)) throw httpError(409,'Настройки изменились в другом окне. Обновите профиль');
    return responseState(req.viewer.id);
  });
  app.post('/api/activate',async req=>{await store.activate(req.viewer.id);return responseState(req.viewer.id)});
  const answerSchema=object({note:text(6000,0),choice:{type:'integer',minimum:0,maximum:20},checked:{type:'array',items:{type:'integer',minimum:0,maximum:20},maxItems:20,uniqueItems:true}},[]);
  app.put('/api/tasks/:id',{schema:{params:object({id:text(64)}),body:object({answer:answerSchema,complete:{type:'boolean'}})}},async req=>{
    if(!req.viewer.activated_at) throw httpError(409,'Сначала активируйте план');
    const task=tasks.find(t=>t.id===req.params.id);
    if(!task || !planTasks(req.viewer.goal).includes(task.id)) throw httpError(404,'Задание не входит в ваш план');
    const {answer,complete}=req.body;
    if(complete){
      if(task.kind==='quiz'&&answer.choice!==task.correct) return {correct:false,feedback:'Обратите внимание на конкретное действие и результат. Попробуйте ещё раз.'};
      if(task.kind==='note'&&(!answer.note||answer.note.trim().length<20)) throw httpError(400,'Напишите хотя бы 20 символов, чтобы сохранить осмысленный ответ');
      if(task.kind==='checklist'&&(!answer.checked||task.checks.some((_,i)=>!answer.checked.includes(i)))) throw httpError(400,'Отметьте все пункты перед завершением');
    }
    await store.saveTask(req.viewer.id,task.id,answer,complete);
    return {...await responseState(req.viewer.id),correct:true,feedback:complete?(task.feedback||'Шаг выполнен. Ваш ответ и прогресс сохранены.'):'Черновик сохранён'};
  });
  app.post('/api/deadlines',{schema:{body:object({title:text(120),dueAt:{type:'string',format:'date-time'}})}},async req=>{
    const due=new Date(req.body.dueAt);
    if(!req.body.title.trim() || due<new Date() || due.getTime()>Date.now()+366*5*86400000) throw httpError(400,'Укажите название и будущую дату в пределах пяти лет');
    if(!await store.addDeadline(req.viewer.id,req.body.title.trim(),due)) throw httpError(400,'Можно сохранить до 50 дедлайнов');
    return responseState(req.viewer.id);
  });
  app.patch('/api/deadlines/:id',{schema:{params:object({id:{type:'string',format:'uuid'}}),body:object({done:{type:'boolean'}})}},async req=>{
    if(!await store.setDeadlineDone(req.viewer.id,req.params.id,req.body.done)) throw httpError(404,'Дедлайн не найден');
    return responseState(req.viewer.id);
  });
  app.delete('/api/deadlines/:id',{schema:{params:object({id:{type:'string',format:'uuid'}})}},async req=>{
    if(!await store.deleteDeadline(req.viewer.id,req.params.id)) throw httpError(404,'Дедлайн не найден');
    return responseState(req.viewer.id);
  });
  app.post('/api/deadlines/:id/export',{schema:{params:object({id:{type:'string',format:'uuid'}})}},async req=>{
    const key=randomBytes(32).toString('hex');
    if(!await store.createDownload(req.viewer.id,req.params.id,digest(key))) throw httpError(404,'Дедлайн не найден');
    return {url:`${config.baseUrl}/download/${key}`,filename:'sk-deadline.ics'};
  });
  app.get('/download/:key',{schema:{params:object({key:{type:'string',pattern:'^[a-f0-9]{64}$'}})}},async(req,reply)=>{
    const d=await store.download(digest(req.params.key));
    if(!d)throw httpError(404,'Ссылка истекла. Создайте файл календаря ещё раз');
    return reply.header('Cache-Control','no-store').header('Content-Disposition','attachment; filename="sk-deadline.ics"')
      .type('text/calendar; charset=utf-8').send(calendarFile(d));
  });
  app.delete('/api/me',{schema:{body:object({confirmation:{const:'DELETE'}})}},async(req,reply)=>{
    await store.deleteUser(req.viewer.id);reply.clearCookie(cookieName,{path:'/',secure:config.production,sameSite:config.production?'none':'lax'});return {deleted:true};
  });
  app.post('/api/bot/webhook',{config:{rateLimit:{max:600,timeWindow:'1 minute'}}},async(req,reply)=>{
    if(!safeEqual(req.headers['x-telegram-bot-api-secret-token'],config.webhookSecret)) throw httpError(403,'Forbidden');
    if(!req.body || !Number.isSafeInteger(req.body.update_id)) throw httpError(400,'Invalid update');
    await handleBotUpdate(req.body,store,bot);return {ok:true};
  });
  await app.register(serveStatic,{root:fileURLToPath(new URL('../public/',import.meta.url)),index:'index.html',cacheControl:true,maxAge:0});
  app.setNotFoundHandler((req,reply)=>reply.code(404).send({error:{message:'Страница не найдена'}}));
  return app;
}
