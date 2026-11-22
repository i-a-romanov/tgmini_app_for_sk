import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(pool) { this.pool = pool; }
  async transaction(work) {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
    catch (error) { await c.query('ROLLBACK'); throw error; }
    finally { c.release(); }
  }
  async migrate() {
    const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    await this.transaction(async c => {
      await c.query('SELECT pg_advisory_xact_lock(904271)');
      await c.query(sql);
    });
  }
  async health() { await this.pool.query('SELECT 1'); }
  async close() { await this.pool.end(); }
  async login(identity, tokenHash) {
    return this.transaction(async c => {
      const { rows: [user] } = await c.query(`INSERT INTO sk_users(telegram_id,first_name,can_message)
        VALUES($1,$2,$3 OR COALESCE((SELECT can_message FROM sk_bot_contacts WHERE telegram_id=$1),false)) ON CONFLICT(telegram_id) DO UPDATE SET first_name=EXCLUDED.first_name,
        can_message=sk_users.can_message OR EXCLUDED.can_message,last_seen_at=now() RETURNING *`,
      [identity.telegramId, identity.firstName.slice(0, 128), identity.canMessage === true]);
      await c.query("INSERT INTO sk_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours')", [tokenHash, user.id]);
      return user;
    });
  }
  async session(tokenHash) {
    const { rows } = await this.pool.query(`SELECT u.* FROM sk_users u JOIN sk_sessions s ON s.user_id=u.id
      WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash]);
    return rows[0];
  }
  async snapshot(userId) {
    const { rows: [user] } = await this.pool.query('SELECT * FROM sk_users WHERE id=$1', [userId]);
    if (!user) return null;
    const { rows: progress } = await this.pool.query('SELECT task_id,answer,completed_at FROM sk_task_progress WHERE user_id=$1', [userId]);
    const { rows: deadlines } = await this.pool.query('SELECT id,title,due_at,done FROM sk_deadlines WHERE user_id=$1 ORDER BY due_at', [userId]);
    return { user, progress, deadlines };
  }
  async updatePreferences(userId, input) {
    const { rows: [user] } = await this.pool.query(`UPDATE sk_users SET goal=$2,pace=$3,timezone=$4,
      reminder_time=$5,reminders=$6,version=version+1,last_seen_at=now()
      WHERE id=$1 AND version=$7 RETURNING *`, [userId,input.goal,input.pace,input.timezone,input.time,input.reminders,input.version]);
    return user;
  }
  async activate(userId) {
    await this.pool.query('UPDATE sk_users SET activated_at=COALESCE(activated_at,now()),last_seen_at=now() WHERE id=$1', [userId]);
  }
  async saveTask(userId, taskId, answer, complete) {
    await this.pool.query(`INSERT INTO sk_task_progress(user_id,task_id,answer,completed_at)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,task_id) DO UPDATE SET answer=EXCLUDED.answer,
      completed_at=COALESCE(sk_task_progress.completed_at,EXCLUDED.completed_at),updated_at=now()`,
      [userId,taskId,JSON.stringify(answer),complete?new Date():null]);
  }
  async addDeadline(userId, title, dueAt) {
    return this.transaction(async c => {
      await c.query('SELECT id FROM sk_users WHERE id=$1 FOR UPDATE', [userId]);
      const { rows: [{ count }] } = await c.query('SELECT count(*) FROM sk_deadlines WHERE user_id=$1', [userId]);
      if (Number(count) >= 50) return null;
      const { rows: [row] } = await c.query('INSERT INTO sk_deadlines(id,user_id,title,due_at) VALUES($1,$2,$3,$4) RETURNING id,title,due_at,done', [randomUUID(),userId,title,dueAt]);
      return row;
    });
  }
  async deleteDeadline(userId, id) { return (await this.pool.query('DELETE FROM sk_deadlines WHERE user_id=$1 AND id=$2', [userId,id])).rowCount; }
  async setDeadlineDone(userId, id, done) { return (await this.pool.query('UPDATE sk_deadlines SET done=$3 WHERE user_id=$1 AND id=$2', [userId,id,done])).rowCount; }
  async createDownload(userId,deadlineId,hash) {
    return (await this.pool.query(`INSERT INTO sk_downloads(token_hash,user_id,deadline_id,expires_at)
      SELECT $3,user_id,id,now()+interval '5 minutes' FROM sk_deadlines WHERE user_id=$1 AND id=$2 RETURNING token_hash`,[userId,deadlineId,hash])).rowCount>0;
  }
  async download(hash) {
    return (await this.pool.query(`SELECT d.* FROM sk_deadlines d JOIN sk_downloads e ON e.deadline_id=d.id
      WHERE e.token_hash=$1 AND e.expires_at>now()`,[hash])).rows[0];
  }
  async deleteUser(userId) { await this.transaction(async c=>{
    await c.query('DELETE FROM sk_bot_contacts WHERE telegram_id=(SELECT telegram_id FROM sk_users WHERE id=$1)',[userId]);
    await c.query('DELETE FROM sk_users WHERE id=$1',[userId]);
  }); }
  async botPermission(telegramId, allowed, stop = false) {
    await this.transaction(async c=>{
      await c.query(`INSERT INTO sk_bot_contacts(telegram_id,can_message) VALUES($1,$2)
        ON CONFLICT(telegram_id) DO UPDATE SET can_message=EXCLUDED.can_message,updated_at=now()`,[telegramId,allowed]);
      await c.query(`UPDATE sk_users SET can_message=$2, reminders=CASE WHEN $3 OR NOT $2 THEN false ELSE reminders END,
        version=version+1 WHERE telegram_id=$1`, [telegramId,allowed,stop]);
    });
  }
  async claimUpdate(id) { return (await this.pool.query('INSERT INTO sk_bot_updates(update_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING update_id', [id])).rowCount > 0; }
  async releaseUpdate(id) { await this.pool.query('DELETE FROM sk_bot_updates WHERE update_id=$1', [id]); }
  async reminderCandidates() {
    return (await this.pool.query(`SELECT u.* FROM sk_users u WHERE reminders=true AND can_message=true
      AND activated_at IS NOT NULL ORDER BY id`)).rows;
  }
  async claimDelivery(userId, day) {
    // Claim before network I/O: a timeout cannot trigger duplicate messages on retry.
    return (await this.pool.query(`INSERT INTO sk_deliveries(user_id,local_day,status)
      SELECT id,$2,'claimed' FROM sk_users WHERE id=$1 AND reminders=true AND can_message=true
      ON CONFLICT DO NOTHING RETURNING user_id`, [userId,day])).rowCount > 0;
  }
  async finishDelivery(userId, day, status) { await this.pool.query('UPDATE sk_deliveries SET status=$3 WHERE user_id=$1 AND local_day=$2', [userId,day,status]); }
  async cleanup() {
    await this.pool.query('DELETE FROM sk_downloads WHERE expires_at<now()');
    await this.pool.query('DELETE FROM sk_sessions WHERE expires_at<now()');
    await this.pool.query("DELETE FROM sk_bot_updates WHERE created_at<now()-interval '7 days'");
    await this.pool.query("DELETE FROM sk_deliveries WHERE created_at<now()-interval '30 days'");
    await this.pool.query("DELETE FROM sk_users WHERE last_seen_at<now()-interval '180 days'");
    await this.pool.query("DELETE FROM sk_bot_contacts WHERE updated_at<now()-interval '180 days' AND telegram_id NOT IN (SELECT telegram_id FROM sk_users)");
  }
}
