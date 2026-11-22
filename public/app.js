const tg=window.Telegram?.WebApp;
const native=!!tg?.initData;
const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={star:'m12 3 3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1Z',book:'M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 14h14M8 7h7',calendar:'M3 5h18v16H3ZM7 3v4m10-4v4M3 11h18',file:'M5 3h9l5 5v13H5Zm9 0v6h5m-11 5 3 3 5-5',check:'m5 12 4 4L19 6',arrow:'m9 5 7 7-7 7',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2',shield:'m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 9 3 3 5-6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4',share:'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.file}"/></svg>`;
const tip=(name,text)=>`<div class="tip">${icon(name)}<span>${esc(text)}</span></div>`;
let config={},data=null,content=null,token=null,csrf=null,screen='entry',stack=[],busy=false,primary=null,draft={},selectedTask=null,selectedArticle=null,answer={},feedback=null,dirty=false,editing=false;
let saveTimer=null;
const safeTimezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Moscow'}catch{return 'Europe/Moscow'}};

async function api(path,{method='GET',body}={}){
 const headers={};if(body!==undefined)headers['Content-Type']='application/json';
 if(token)headers.Authorization=`Bearer ${token}`;if(csrf)headers['X-CSRF-Token']=csrf;
 let response;
 try{response=await fetch(`/api${path}`,{method,headers,credentials:'include',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)})}
 catch{throw new Error('Нет связи с сервером. Проверьте интернет и повторите действие. В бесплатном пилоте первый запуск может занять около минуты.')}
 let result;try{result=await response.json()}catch{throw new Error('Сервер запускается или временно недоступен. Повторите через минуту.')}
 if(!response.ok){const err=new Error(result.error?.message||'Не удалось выполнить действие');err.status=response.status;throw err}
 return result;
}
function accept(result){if(result.profile)data=result;if(result.content)content=result.content;if(result.accessToken)token=result.accessToken;if(result.csrfToken)csrf=result.csrfToken}
function showError(error){el('notice').hidden=false;el('notice').replaceChildren();const text=document.createElement('span');text.textContent=error.message||String(error);el('notice').append(text);const button=document.createElement('button');button.textContent=error.status===401?'Открыть заново':'Закрыть';button.onclick=()=>{el('notice').hidden=true;if(error.status===401)location.reload()};el('notice').append(button)}
async function run(action){if(busy||!action)return;busy=true;syncAction();try{await action()}catch(error){showError(error)}finally{busy=false;syncAction()}}
function syncTheme(){
 const theme=native?tg.colorScheme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.body.dataset.theme=theme;
 if(!native)return;
 const p=tg.themeParams||{},css=document.documentElement.style;
 for(const [name,value]of Object.entries({'--bg':p.bg_color,'--surface':p.secondary_bg_color,'--ink':p.text_color,'--muted':p.hint_color,'--accent-ink':p.link_color}))if(value)css.setProperty(name,value);
 if(tg.isVersionAtLeast('6.1')){tg.setHeaderColor('bg_color');tg.setBackgroundColor(p.bg_color||(theme==='dark'?'#17161e':'#f6f6f8'))}
 syncAction();
}
function syncAction(){
 const disabled=busy||!!primary?.disabled;
 for(const control of document.querySelectorAll('#content button,#content input,#content select,#content textarea'))control.disabled=busy;
 el('action-bar').hidden=!primary||native;
 if(primary){el('primary').textContent=busy?'Сохраняем…':primary.label;el('primary').disabled=disabled}
 if(native){
  if(primary){tg.MainButton.setParams({text:primary.label,is_visible:true,is_active:!disabled,color:tg.themeParams.button_color||'#4b32df',text_color:tg.themeParams.button_text_color||'#ffffff'});if(busy)tg.MainButton.showProgress();else tg.MainButton.hideProgress()}
  else{tg.MainButton.hideProgress();tg.MainButton.hide()}
  if(stack.length)tg.BackButton.show();else tg.BackButton.hide();
  if(tg.isVersionAtLeast('6.2')){if(dirty)tg.enableClosingConfirmation();else tg.disableClosingConfirmation()}
 }
 el('back').hidden=!stack.length;el('profile').hidden=!data;
}
function setPrimary(label,action,disabled=false){primary={label,action,disabled}}
async function preserveDraft(){
 if(screen==='task'&&dirty){clearTimeout(saveTimer);await saveTask(false);}
}
async function go(next,{task,article,replace=false}={}){
 await preserveDraft();
 if(!replace)stack.push({screen,selectedTask,selectedArticle});
 screen=next;feedback=null;
 if(task){selectedTask=task;answer=structuredClone(data.progress.find(p=>p.taskId===task)?.answer||{});dirty=false}
 if(article)selectedArticle=article;
 render();window.scrollTo(0,0);el('content').focus({preventScroll:true});
}
async function back(){await preserveDraft();const prev=stack.pop();if(!prev)return;screen=prev.screen;selectedTask=prev.selectedTask;selectedArticle=prev.selectedArticle;feedback=null;if(screen==='task')answer=structuredClone(data.progress.find(p=>p.taskId===selectedTask)?.answer||{});render();window.scrollTo(0,0)}
const taskIds=()=>content.goals.find(g=>g.id===data.profile.goal).taskIds;
const progressFor=id=>data.progress.find(p=>p.taskId===id);
const nextTask=()=>taskIds().find(id=>!progressFor(id)?.completed);
const taskRow=t=>`<button class="task-row" data-task="${t.id}"><span class="iconbox">${icon(progressFor(t.id)?.completed?'check':'file')}</span><span><b>${esc(t.title)}</b><span class="small">${esc(t.category)} · ${t.minutes} минут</span></span>${progressFor(t.id)?.completed?'<span class="done-badge">Готово</span>':icon('arrow')}</button>`;
const goalName=id=>content.goals.find(g=>g.id===id)?.title||'';
const dateLabel=date=>new Intl.DateTimeFormat('ru',{timeZone:data.profile.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(date));
function startSettings(){draft={...data.profile};editing=data.profile.active;run(()=>go('track'))}
async function savePreferences(){
 const body={goal:draft.goal,pace:Number(draft.pace),timezone:draft.timezone,time:draft.time,reminders:draft.reminders,version:data.profile.version};
 try{accept(await api('/preferences',{method:'PUT',body}));dirty=false}
 catch(error){if(error.status===409){const fresh=await api('/me');accept(fresh)}throw error}
}
async function saveTask(complete){
 const id=selectedTask,payload=structuredClone(answer);
 const result=await api(`/tasks/${id}`,{method:'PUT',body:{answer:payload,complete}});
 if(result.correct===false){feedback={text:result.feedback,success:false};render();return}
 accept(result);dirty=false;if(complete){feedback={text:result.feedback,success:true};haptic('success');render()}else{const hint=el('save-status');if(hint)hint.textContent='Черновик сохранён';syncAction()}
}
function markDirty(){dirty=true;feedback=null;syncAction();const hint=el('save-status');if(hint)hint.textContent='Есть несохранённые изменения';}
function haptic(type){if(native&&tg.isVersionAtLeast('6.1'))tg.HapticFeedback.notificationOccurred(type)}
async function requestReminders(checked){
 if(!checked){draft.reminders=false;render();return}
 if(!config.remindersAvailable){showError(new Error('Напоминания недоступны в локальной разработке'));render();return}
 if(data.profile.canMessage){draft.reminders=true;render();return}
 if(native&&tg.isVersionAtLeast('6.9')){
  const allowed=await new Promise(resolve=>tg.requestWriteAccess(resolve));
  if(allowed){
   // Permission is confirmed by the signed launch data or Telegram webhook, not the client boolean.
   for(let i=0;i<5;i++){accept(await api('/me'));if(data.profile.canMessage)break;await new Promise(r=>setTimeout(r,600))}
  }
  draft.reminders=!!data.profile.canMessage;
  if(!draft.reminders)showError(new Error('Разрешение пока не подтверждено. Отправьте боту /start и попробуйте включить напоминания ещё раз.'));
 }else showError(new Error('Откройте чат с ботом, отправьте /start, затем вернитесь в приложение.'));
 render();
}
function render(){
 primary=null;let html='';const p=data?.profile;
 document.body.dataset.screen=screen;
 if(screen==='entry'){
 html=`<p class="eyebrow">Ваш путь к поступлению</p><div class="hero-art"><i class="orbit"></i><i class="orbit second"></i><div class="mark">SK</div><span class="floating one">${icon('check')} Один шаг за раз</span><span class="floating two">${icon('clock')} В вашем темпе</span></div><h1 class="entry-title">Большая цель.<br>Понятный первый шаг.</h1><p class="sub">Подготовка к поступлению и конкурсу грантов Сколково — с понятным планом.</p><div class="entry-benefits"><div class="row"><span class="iconbox">${icon('file')}</span><div><b>Личный план подготовки</b><p class="small">Задачи, материалы и прогресс</p></div></div><div class="row"><span class="iconbox">${icon('bell')}</span><div><b>Важные даты под рукой</b><p class="small">Ваши дедлайны и напоминания</p></div></div></div><p class="disclosure">Независимый проект студентов. Не связан с приёмной комиссией и не гарантирует поступление.</p><button class="text-button" data-nav="privacy">Какие данные мы сохраняем</button>`;
 setPrimary('Составить мой план',async()=>{draft={...p};if(!p.active&&p.version===1)draft.timezone=safeTimezone();editing=false;await go('track')});
 }else if(screen==='track'){
 html=`${steps(1)}<h1>С чего начнём?</h1><p class="sub">Выберите ближайшую цель. Её можно изменить позже.</p><div class="choices">${content.goals.map((g,i)=>`<button class="choice ${draft.goal===g.id?'selected':''}" data-goal="${g.id}" aria-pressed="${draft.goal===g.id}"><span class="iconbox">${icon(['star','book','spark'][i])}</span><span><b>${esc(g.title)}</b><span class="small">${esc(g.description)}</span></span><span class="radio"></span></button>`).join('')}</div>${tip('shield','Не просим телефон, документы или резюме. Для каждой цели есть отдельная последовательность задач.')}`;
 setPrimary('Продолжить',async()=>{await savePreferences();await go('schedule')});
 }else if(screen==='schedule'){
 html=`${steps(2)}<h1>Подстроимся<br>под ваш день</h1><p class="sub">Даже короткая задача помогает двигаться вперёд.</p><div class="section-title">Время на подготовку</div><div class="row">${[10,15,25].map(t=>`<button class="choice ${draft.pace===t?'selected':''}" data-pace="${t}" aria-pressed="${draft.pace===t}"><b>${t} мин</b></button>`).join('')}</div><div class="card" style="margin-top:20px"><label class="switch-row"><span><b>Напоминать о задачах</b><span class="small" style="display:block">В личном чате с ботом</span></span><input class="switch" id="reminders" type="checkbox" ${draft.reminders?'checked':''} aria-label="Напоминать о задачах"></label></div><label class="field"><span>Удобное время</span><input id="reminder-time" type="time" value="${esc(draft.time)}" required></label><label class="field"><span>Часовой пояс</span><select id="timezone">${timezoneOptions(draft.timezone)}</select></label>${config.pilot?'<p class="form-warning">Бесплатный пилот: когда сервер спит, напоминания могут задержаться или не прийти. Важные даты дополнительно сохраните в своём календаре.</p>':''}`;
 setPrimary('Посмотреть мой план',async()=>{await savePreferences();await go('review')});
 }else if(screen==='review'){
 html=`${steps(3)}<h1>Ваш план<br>на хороший старт</h1><p class="sub">Проверьте детали. Всё можно изменить в профиле.</p><div class="review-list"><div class="row"><span class="iconbox">${icon('star')}</span><div><b>${esc(goalName(draft.goal))}</b><p class="small">${content.goals.find(g=>g.id===draft.goal).taskIds.length} задач подготовки</p></div></div><div class="row"><span class="iconbox">${icon('clock')}</span><div><b>${draft.pace} минут в день</b><p class="small">Одна небольшая задача за раз</p></div></div><div class="row"><span class="iconbox">${icon('bell')}</span><div><b>${draft.reminders?esc(draft.time):'Без напоминаний'}</b><p class="small">${esc(draft.timezone)}</p></div></div></div><div class="price"><span><b>Доступ к плану</b><span class="small" style="display:block">Без подписки и оплаты</span></span><strong>0 ₽</strong></div><p class="disclosure">Сохраняем цель, ответы и прогресс, чтобы вы могли вернуться к подготовке.</p><button class="text-button" data-nav="privacy">Мои данные и их удаление</button>`;
 setPrimary(editing?'Сохранить настройки':'Активировать бесплатный план',async()=>{await savePreferences();if(!p.active)accept(await api('/activate',{method:'POST'}));stack=[];await go(editing?'home':'success',{replace:true})});
 }else if(screen==='success'){
 const task=content.tasks.find(t=>t.id===nextTask());
 html=`<div class="success-art"><div class="success-ring">${icon('check')}</div></div><div class="center"><p class="eyebrow">Всё готово для начала</p><h1>У вас есть план.<br>Теперь — первый шаг.</h1><p class="sub">Большая подготовка начинается с маленькой задачи.</p></div><div class="card next-card"><span class="tag">Первая задача · ${task?.minutes||5} минут</span><h3>${esc(task?.title||'Посмотреть план')}</h3><p class="small">План сохранён. Можно продолжить в любое время.</p></div><p class="disclosure center">Это план подготовки.<br>Заявка в Сколково ещё не подана.</p>`;
 setPrimary('Начать первую задачу',()=>go(task?'task':'home',{task:task?.id}));
 }else if(screen==='home'){
 const t=content.tasks.find(t=>t.id===nextTask()),near=data.deadlines.find(d=>!d.done&&new Date(d.dueAt)>=new Date());
 html=`<div class="greeting"><div><p class="small">Хороший день, чтобы начать</p><h1>${esc(p.name)}, вы на пути</h1></div><button class="avatar" data-nav="profile" aria-label="Мой профиль">${esc(p.name.slice(0,1))}</button></div><div class="readiness"><p>Ваш план подготовки</p><div class="number">${data.summary.percent}% <span>${data.summary.completed} из ${data.summary.total} шагов</span></div><div class="progress"><div style="width:${data.summary.percent}%"></div></div><p class="small">Прогресс по чек-листу, не оценка шансов</p></div><button class="card deadline" data-nav="deadlines" style="width:100%;text-align:left"><div class="calendar">${icon('calendar')}</div><div><p class="small">${near?'Личный дедлайн':'Важные даты'}</p><b>${esc(near?.title||'Добавьте свой дедлайн')}</b><p class="small">${near?esc(dateLabel(near.dueAt)):'Официальные даты уточняйте у организатора'}</p></div></button><div class="features"><button class="feature primary" data-group="strengths">${icon('star')}<b>Сильные стороны</b><span class="small">Найдите опору в своём опыте</span></button><button class="feature" data-nav="materials">${icon('book')}<b>Материалы</b><span class="small">Гайды, эссе, интервью</span></button><button class="feature" data-nav="deadlines">${icon('calendar')}<b>Дедлайны</b><span class="small">Личные даты и календарь</span></button><button class="feature" data-resume="true">${icon('file')}<b>Чек-лист резюме</b><span class="small">Проверить самостоятельно</span></button></div><div class="section-title">${t?'Следующий шаг':'План завершён'} <span>${p.pace} минут в день</span></div>${t?taskRow(t):'<div class="card"><h3>Все шаги выполнены</h3><p class="sub">Проверьте актуальные требования и подавайте заявку через официальный канал организатора.</p></div>'}<button class="text-button" data-nav="plan">Посмотреть весь план</button>`;
 setPrimary(t?'Продолжить подготовку':'Посмотреть мой план',()=>go(t?'task':'plan',{task:t?.id}));
 }else if(screen==='plan'||screen==='strengths'){
 let list=taskIds().map(id=>content.tasks.find(t=>t.id===id));if(screen==='strengths')list=list.filter(t=>['Сильные стороны','Мотивация','Развитие'].includes(t.category));
 html=`<h1>${screen==='plan'?'Ваш план подготовки':'Ваши сильные стороны'}</h1><p class="sub">${screen==='plan'?'Двигайтесь по порядку или выберите нужную задачу.':'Это упражнения для саморефлексии, а не психологический тест или прогноз поступления.'}</p><div class="task-list">${list.map(taskRow).join('')}</div>`;setPrimary('На главную',()=>go('home'));
 }else if(screen==='task'){
 const t=content.tasks.find(t=>t.id===selectedTask),done=progressFor(t.id)?.completed;
 html=`<p class="eyebrow">${esc(t.category)} · ${t.minutes} минут</p><h1>${esc(t.title)}</h1>${done?'<span class="tag" style="margin-top:14px">Шаг выполнен</span>':''}<div class="article">${t.body.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`;
 if(t.kind==='quiz')html+=`<p class="task-question">${esc(t.prompt)}</p><div class="task-options">${t.options.map((s,i)=>`<button class="choice ${answer.choice===i?'selected':''}" data-answer="${i}" aria-pressed="${answer.choice===i}"><span>${esc(s)}</span><span class="radio"></span></button>`).join('')}</div>`;
 if(t.kind==='note')html+=`<label class="field"><span>${esc(t.prompt)}</span><textarea id="task-note" maxlength="6000" placeholder="Запишите свой ответ…">${esc(answer.note||'')}</textarea><span class="small" id="save-status">${dirty?'Есть несохранённые изменения':'Можно сохранить черновик и вернуться позже'}</span></label><button class="secondary" id="save-draft">Сохранить черновик</button>`;
 if(t.kind==='checklist')html+=`<div class="checks">${t.checks.map((s,i)=>`<label class="check-item"><input type="checkbox" data-check="${i}" ${(answer.checked||[]).includes(i)?'checked':''}><span>${esc(s)}</span></label>`).join('')}</div>`;
 if(feedback)html+=`<div class="${feedback.success?'success-feedback':'toast'}" role="status">${esc(feedback.text)}</div>`;
 setPrimary(feedback?.success?'Вернуться к плану':t.kind==='quiz'?'Проверить ответ':done?'Сохранить изменения':'Завершить шаг',feedback?.success?()=>go('home'):()=>saveTask(true),!taskReady(t));
 }else if(screen==='materials'){
 html=`<h1>Материалы<br>для подготовки</h1><p class="sub">Короткие авторские гайды. Точные условия поступления проверяйте у организатора.</p><div class="task-list">${content.materials.map(m=>`<button class="task-row" data-article="${m.id}"><span class="iconbox">${icon('book')}</span><span><b>${esc(m.title)}</b><span class="small">${esc(m.category)} · ${m.minutes} минуты</span></span>${icon('arrow')}</button>`).join('')}</div>`;setPrimary('На главную',()=>go('home'));
 }else if(screen==='article'){
 const m=content.materials.find(m=>m.id===selectedArticle);html=`<p class="eyebrow">${esc(m.category)} · ${m.minutes} минуты</p><h1>${esc(m.title)}</h1><div class="article">${m.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div><p class="brand-note">Материал SK Fast Track. Общие рекомендации по подготовке, не официальные критерии отбора.</p>`;setPrimary('К материалам',()=>go('materials'));
 }else if(screen==='deadlines'){
 html=`<h1>Важные даты</h1><p class="sub">Ваши личные дедлайны. Официальные сроки сверяйте с правилами организатора.</p><p class="small" style="margin-top:10px">Отображаются в часовом поясе ${esc(p.timezone)}.</p>${data.deadlines.length?data.deadlines.map(d=>`<div class="card deadline-item"><span class="badge">${d.done?'Выполнено':new Date(d.dueAt)<new Date()?'Дата прошла':'Личный дедлайн'}</span><h3>${esc(d.title)}</h3><p class="sub">${esc(dateLabel(d.dueAt))}</p><div class="deadline-actions"><button data-deadline-done="${d.id}">${d.done?'Вернуть в план':'Отметить выполненным'}</button><button data-calendar="${d.id}">В календарь</button><button class="danger" data-deadline-delete="${d.id}">Удалить</button></div></div>`).join(''):'<div class="list-empty"><h3>Пока нет дедлайнов</h3><p class="sub">Добавьте дату, которую проверили сами.</p></div>'}<p class="brand-note">Бот напоминает о ежедневной подготовке. Для точного уведомления о дате добавьте событие в свой календарь.</p>`;setPrimary('Добавить дедлайн',()=>go('deadline-new'));
 }else if(screen==='deadline-new'){
 html=`<h1>Новый дедлайн</h1><p class="sub">Дата и время вводятся в часовом поясе этого устройства: ${esc(safeTimezone())}.</p><label class="field"><span>Что нужно сделать</span><input id="deadline-title" maxlength="120" placeholder="Например, отправить анкету" autocomplete="off"></label><label class="field"><span>Дата и время</span><input id="deadline-date" type="datetime-local" required></label>${tip('calendar','Проверьте часовой пояс и официальный срок. Эта дата будет сохранена как ваш личный дедлайн.')}`;
 setPrimary('Сохранить дедлайн',async()=>{const value=el('deadline-date').value,title=el('deadline-title').value.trim();if(!title||!value)throw new Error('Укажите название, дату и время');accept(await api('/deadlines',{method:'POST',body:{title,dueAt:new Date(value).toISOString()}}));await go('deadlines')});
 }else if(screen==='profile'){
 html=`<div class="profile-head"><div class="avatar">${esc(p.name.slice(0,1))}</div><div><h1>${esc(p.name)}</h1><p class="sub">Ваш профиль подготовки</p></div></div><div class="card"><div class="settings-row"><div><b>Моя цель</b><span class="small">${esc(goalName(p.goal))}</span></div><button class="text-button" data-settings="true">Изменить</button></div><div class="settings-row"><div><b>Мой темп</b><span class="small">${p.pace} минут в день</span></div></div><div class="settings-row"><div><b>Напоминания</b><span class="small">${p.reminders?esc(p.time)+' · '+esc(p.timezone):'Выключены'}</span></div><button class="text-button" id="reminder-settings">Настроить</button></div></div><div class="section-title">Ваши данные — под контролем</div><div class="card" style="padding:2px 16px"><button class="full-button" data-nav="privacy">Мои данные ${icon('shield')}</button><button class="full-button" id="share">Рассказать другу ${icon('share')}</button><button class="full-button" data-nav="help">Помощь ${icon('arrow')}</button></div><p class="brand-note">SK Fast Track — независимый проект студентов. Условия поступления уточняйте у приёмной комиссии.</p>`;setPrimary(p.active?'Вернуться к плану':'Продолжить настройку',()=>go(p.active?'home':'entry'));
 }else if(screen==='privacy'){
 html=`<h1>Ваши данные</h1><div class="article"><p>Сервис ведёт ${esc(config.operatorName)}. Это независимый проект для подготовки.</p><h2>Что сохраняется</h2><ul><li>Числовой ID и имя из Telegram — для входа и восстановления профиля.</li><li>Выбранная цель, темп, часовой пояс и настройки напоминаний.</li><li>Ваши ответы на задания, прогресс и личные дедлайны.</li></ul><p>Телефон, документы и резюме мы не запрашиваем. Не записывайте в задания паспортные данные, пароли и другую чувствительную информацию.</p><h2>Где и как долго</h2><p>Рабочие данные хранятся в PostgreSQL, подключённом владельцем сервиса на Render. Доступ к профилю проверяется по авторизации Telegram. Неактивные профили удаляются после 180 дней без использования при следующем запуске обслуживания.</p><p>Вы можете удалить профиль сейчас. Это удалит ответы, прогресс, даты, активные сессии и записи напоминаний из рабочей базы. Копии инфраструктуры удаляются по правилам выбранного владельцем хостинга.</p><h2>Сообщения</h2><p>Напоминания необязательны. Отключите их в профиле или отправьте боту /stop. Удаление профиля не удаляет уже полученные сообщения из вашего Telegram.</p></div>${data?'<button class="secondary danger" data-nav="delete">Удалить мой профиль</button>':''}`;setPrimary('Назад',()=>stack.length?back():go(data?.profile.active?'home':'entry'));
 }else if(screen==='delete'){
 html=`<h1>Удалить профиль?</h1><p class="sub">Будут удалены ответы, прогресс, настройки и личные дедлайны. Восстановить их через приложение нельзя.</p><label class="field"><span>Для подтверждения введите УДАЛИТЬ</span><input id="delete-confirm" autocomplete="off"></label>`;setPrimary('Удалить мои данные',async()=>{if(el('delete-confirm').value!=='УДАЛИТЬ')throw new Error('Введите УДАЛИТЬ для подтверждения');await api('/me',{method:'DELETE',body:{confirmation:'DELETE'}});token=null;csrf=null;data=null;stack=[];el('content').innerHTML='<div class="loading"><div class="mark">SK</div><h1>Профиль удалён</h1><p class="sub">Ваши рабочие данные удалены. Закройте приложение. При следующем входе можно создать новый план.</p></div>';primary=null;syncAction();if(native)tg.BackButton.hide()});
 }else if(screen==='help'){
 html=`<h1>Как пользоваться</h1><div class="article"><p>Выберите цель, настройте темп и начните любую задачу. Черновики сохраняются кнопкой «Сохранить черновик» или при переходе назад.</p><p>Для сообщений от бота разрешите доступ при настройке напоминаний. Если подтверждение не появилось, отправьте боту /start. Команда /stop отключает напоминания.</p><p>Бесплатный сервер может запускаться около минуты после простоя. При ошибке дождитесь запуска и повторите действие. Не закрывайте приложение до сохранения черновика.</p><p>Задания и материалы — общая помощь в подготовке. Подача заявки и проверка её статуса проходят на официальной площадке организатора.</p>${config.supportUrl?`<a href="${esc(config.supportUrl)}" target="_blank" rel="noopener noreferrer">Связаться с командой</a>`:'<p>Для связи с командой используйте контакт, через который получили ссылку на этот пилот.</p>'}</div>`;setPrimary('В профиль',()=>go('profile'));
 }
 el('content').innerHTML=html;bind();syncAction();
}
function steps(n){return `<div class="steps">${[1,2,3].map(i=>`<i class="${i<=n?'active':''}"></i>`).join('')}</div><p class="eyebrow">Шаг ${n} из 3 · ваш план</p>`}
function timezoneOptions(current){const zones=[...new Set([current,'Europe/Kaliningrad','Europe/Moscow','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk','Asia/Novosibirsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok','Asia/Magadan','Asia/Kamchatka','UTC'])];return zones.map(z=>`<option value="${esc(z)}" ${z===current?'selected':''}>${esc(z)}</option>`).join('')}
function taskReady(t){if(feedback?.success)return true;if(t.kind==='quiz')return Number.isInteger(answer.choice);if(t.kind==='note')return (answer.note||'').trim().length>=20;return t.checks.every((_,i)=>(answer.checked||[]).includes(i))}
function bind(){
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>run(()=>go(b.dataset.nav)));
 document.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{if(busy)return;draft.goal=b.dataset.goal;render()});
 document.querySelectorAll('[data-pace]').forEach(b=>b.onclick=()=>{if(busy)return;draft.pace=+b.dataset.pace;render()});
 document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>run(()=>go('task',{task:b.dataset.task})));
 document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>run(()=>go(b.dataset.group)));
 document.querySelectorAll('[data-article]').forEach(b=>b.onclick=()=>run(()=>go('article',{article:b.dataset.article})));
 document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=startSettings);
 document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(busy)return;answer.choice=+b.dataset.answer;markDirty();render()});
 document.querySelectorAll('[data-check]').forEach(b=>b.onchange=()=>{answer.checked=[...document.querySelectorAll('[data-check]:checked')].map(x=>+x.dataset.check);markDirty();primary.disabled=!taskReady(content.tasks.find(t=>t.id===selectedTask));syncAction()});
 document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>run(()=>taskIds().includes('resume')?go('task',{task:'resume'}):go('article',{article:'resume'})));
 if(el('task-note'))el('task-note').oninput=e=>{answer.note=e.target.value;markDirty();primary.disabled=!taskReady(content.tasks.find(t=>t.id===selectedTask));syncAction()};
 if(el('save-draft'))el('save-draft').onclick=()=>run(()=>saveTask(false));
 if(el('reminders'))el('reminders').onchange=e=>run(()=>requestReminders(e.target.checked));
 if(el('reminder-time'))el('reminder-time').onchange=e=>{draft.time=e.target.value||'19:00'};
 if(el('timezone'))el('timezone').onchange=e=>{draft.timezone=e.target.value};
 if(el('reminder-settings'))el('reminder-settings').onclick=()=>run(async()=>{draft={...data.profile};editing=data.profile.active;await go('schedule')});
 if(el('share'))el('share').onclick=()=>run(async()=>{
  if(!config.botUsername)throw new Error('Ссылка на бота пока не настроена владельцем сервиса');
  const url=`https://t.me/${config.botUsername}?startapp=shared`,link=`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('SK Fast Track — мой помощник в подготовке к поступлению')}`;
  if(native)tg.openTelegramLink(link);else window.open(link,'_blank','noopener');
 });
 document.querySelectorAll('[data-deadline-delete]').forEach(b=>b.onclick=()=>run(async()=>{if(!await confirmAction('Удалить этот личный дедлайн?'))return;accept(await api(`/deadlines/${b.dataset.deadlineDelete}`,{method:'DELETE'}));render()}));
 document.querySelectorAll('[data-deadline-done]').forEach(b=>b.onclick=()=>run(async()=>{const d=data.deadlines.find(d=>d.id===b.dataset.deadlineDone);accept(await api(`/deadlines/${d.id}`,{method:'PATCH',body:{done:!d.done}}));render()}));
 document.querySelectorAll('[data-calendar]').forEach(b=>b.onclick=()=>run(()=>downloadCalendar(data.deadlines.find(d=>d.id===b.dataset.calendar))));
}
function confirmAction(text){return native&&tg.isVersionAtLeast('6.2')?new Promise(resolve=>tg.showConfirm(text,resolve)):Promise.resolve(confirm(text))}
async function downloadCalendar(d){
 const file=await api(`/deadlines/${d.id}/export`,{method:'POST'});
 if(native&&tg.isVersionAtLeast('8.0')&&typeof tg.downloadFile==='function')tg.downloadFile({url:file.url,file_name:file.filename});
 else if(native)tg.openLink(file.url);
 else{const a=document.createElement('a');a.href=file.url;a.download=file.filename;a.click()}
}
async function boot(){
 el('notice').hidden=true;primary=null;syncAction();
 try{
  config=await api('/config');el('dev-banner').hidden=!config.devAuth;
  try{accept(await api('/me'))}catch(error){
   if(error.status!==401)throw error;
   if(native)accept(await api('/auth/telegram',{method:'POST',body:{initData:tg.initData}}));
   else if(config.devAuth)accept(await api('/auth/dev',{method:'POST'}));
   else{el('content').innerHTML=`<div class="loading"><div class="mark">SK</div><h1>Откройте в Telegram</h1><p class="sub">Ваш план доступен через нашего бота.</p>${config.botUsername?`<div class="auth-actions"><a class="main-button" href="https://t.me/${encodeURIComponent(config.botUsername)}">Перейти к боту</a></div>`:'<p class="small">Владелец сервиса ещё настраивает бота. Попробуйте позже.</p>'}</div>`;return}
  }
  draft={...data.profile};screen=data.profile.active?'home':'entry';render();
 }catch(error){el('content').innerHTML='<div class="loading"><div class="mark">SK</div><h1>Не удалось открыть план</h1><p class="sub">Проверьте связь. Если сессия устарела, закройте приложение и откройте его снова через бота.</p><button class="secondary" id="retry-boot">Повторить</button></div>';el('retry-boot').onclick=boot;showError(error)}
}
el('primary').onclick=()=>run(primary?.action);el('back').onclick=()=>run(back);el('profile').onclick=()=>run(()=>go('profile'));
document.body.classList.toggle('tg-native',native);
if(native){tg.ready();tg.expand();tg.MainButton.onClick(()=>run(primary?.action));tg.BackButton.onClick(()=>run(back));tg.onEvent('themeChanged',syncTheme);if(tg.isVersionAtLeast('7.0')){tg.SettingsButton.show();tg.onEvent('settingsButtonClicked',()=>run(()=>go('profile')))}}
else matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncTheme);
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
syncTheme();boot();
