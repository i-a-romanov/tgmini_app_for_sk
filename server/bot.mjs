import { timingSafeEqual } from 'node:crypto';
import { planTasks } from './content.mjs';

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export class TelegramBot {
  constructor(token, baseUrl, fetcher = fetch) { this.token = token; this.baseUrl = baseUrl; this.fetcher = fetcher; }
  async call(method, body = {}) {
    let response;
    try { response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(12000),
    }); } catch { throw new Error('Telegram network unavailable'); }
    let result; try { result = await response.json(); } catch { throw new Error('Invalid Telegram response'); }
    if (!response.ok || !result.ok) {
      const error = new Error(`Telegram ${method} failed`); // Never expose a token-bearing URL.
      error.code = result.error_code || response.status; throw error;
    }
    return result.result;
  }
  async setup(secret) {
    const me = await this.call('getMe');
    await this.call('setWebhook', { url: this.baseUrl + '/api/bot/webhook', secret_token:secret,
      allowed_updates:['message','my_chat_member'], drop_pending_updates:false });
    await this.call('setChatMenuButton', { menu_button:{type:'web_app',text:'Мой план',web_app:{url:this.baseUrl}} });
    await this.call('setMyCommands', { commands:[
      {command:'start',description:'Открыть план подготовки'}, {command:'help',description:'Помощь и данные'},
      {command:'stop',description:'Отключить напоминания'}, {command:'delete',description:'Как удалить мои данные'},
    ] });
    return me.username;
  }
  send(chatId, text) { return this.call('sendMessage',{chat_id:chatId,text,
    reply_markup:{inline_keyboard:[[{text:'Открыть мой план',web_app:{url:this.baseUrl}}]]}}); }
}

export async function handleBotUpdate(update, store, bot) {
  if (!Number.isSafeInteger(update.update_id)) return;
  if (!await store.claimUpdate(update.update_id)) return;
  try {
    const membership = update.my_chat_member;
    if (membership?.chat?.type === 'private') {
      const allowed = !['kicked','left'].includes(membership.new_chat_member?.status);
      await store.botPermission(String(membership.chat.id),allowed);
    }
    const m = update.message;
    if (!m || m.chat?.type !== 'private' || !m.from || m.from.is_bot || m.from.id !== m.chat.id) return;
    const id = String(m.from.id);
    if (m.write_access_allowed) await store.botPermission(id,true);
    const command = typeof m.text === 'string' ? m.text.split(/\s/)[0].split('@')[0] : '';
    if (command === '/start') {
      await store.botPermission(id,true);
      await bot.send(id,'SK Fast Track — независимый помощник для подготовки. Выберите цель, составьте план и начните с короткой задачи. Напоминания включаются отдельно в приложении.');
    } else if (command === '/stop') {
      await store.botPermission(id,true,true);
      await bot.send(id,'Напоминания отключены. План и прогресс сохранены. Включить их снова можно в профиле приложения.');
    } else if (command === '/help' || command === '/delete') {
      await bot.send(id,'В приложении доступны задания, материалы и личные дедлайны. Профиль → «Мои данные» позволяет прочитать правила хранения и удалить профиль вместе с прогрессом. /stop отключает напоминания. Это независимый сервис, не приёмная комиссия.');
    }
  } catch (error) {
    // Known permanent failures must not make Telegram retry indefinitely.
    if (error.code === 403 || error.code === 400) return;
    await store.releaseUpdate(update.update_id); throw error;
  }
}

export function reminderWindow(user, date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:user.timezone,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
  const [hour,minute] = user.reminder_time.split(':').map(Number);
  const lag = Number(values.hour)*60+Number(values.minute)-hour*60-minute;
  return lag >= 0 && lag < 30 ? `${values.year}-${values.month}-${values.day}` : null;
}
export async function runReminders(store, bot, date = new Date()) {
  let sent = 0;
  for (const user of await store.reminderCandidates()) {
    const day = reminderWindow(user,date); if (!day) continue;
    const snapshot = await store.snapshot(user.id); if (!snapshot) continue;
    const done = new Set(snapshot.progress.filter(p=>p.completed_at).map(p=>p.task_id));
    const remaining = planTasks(user.goal).filter(id=>!done.has(id)); if (!remaining.length) continue;
    if (!await store.claimDelivery(user.id,day)) continue;
    // Re-check preferences after acquiring the delivery record.
    const current = await store.snapshot(user.id);
    if (!current?.user.reminders || !current.user.can_message) continue;
    try {
      await bot.send(String(user.telegram_id),`Время для небольшого шага: ${user.pace} минут на подготовку. В вашем плане осталось задач: ${remaining.length}. Отключить напоминания: /stop`);
      await store.finishDelivery(user.id,day,'sent'); sent++;
    } catch (error) {
      if (error.code === 403 || error.code === 400) await store.botPermission(String(user.telegram_id),false);
      await store.finishDelivery(user.id,day,'failed');
      // Intentionally no resend after ambiguous network failure: avoid duplicate reminders.
    }
  }
  return sent;
}
