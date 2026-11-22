"""Build editable HTML design boards; run render-design.cjs to export PNGs."""
from pathlib import Path
import html

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/design'
OUT.mkdir(parents=True, exist_ok=True)

stages = [
 dict(title='Awareness', ru='Узнаёт', icon='spark',
 goal='Find a credible route to a Skolkovo grant.',
 actions='Sees a student-channel post; asks a friend; follows the bot link.',
 touch='Student channels, peer recommendations, campaign deep link.',
 emotion='Curious, but unsure', score=56,
 pain='Scattered information. “Is this for someone like me?”',
 opportunity='One clear promise; a useful sample task; student-made disclosure.',
 measure='Qualified link → app opens'),
 dict(title='Telegram entry',ru='Открывает',icon='arrow',
 goal='Understand the value before sharing any information.',
 actions='Opens the Mini App; reads the free-access and independence statement.',
 touch='Bot profile, menu button, entry screen and Telegram header.',
 emotion='Cautious',score=35,
 pain='Fear of spam or an unofficial service posing as admissions.',
 opportunity='No phone request. Plain privacy explanation. One “Create my plan” action.',
 measure='App opens → onboarding starts'),
 dict(title='Onboarding',ru='Настраивает',icon='file',
 goal='Get a plan that fits their goal and available time.',
 actions='Chooses a goal and daily pace; optionally enables reminders; reviews plan.',
 touch='Three-step flow; native MainButton and BackButton; permission dialog.',
 emotion='Reassured',score=69,
 pain='Too many questions; uncertainty about deadlines; notification fatigue.',
 opportunity='Short flow; saved draft; editable choices; reminders off by default.',
 measure='Starts → plan activations'),
 dict(title='Core action',ru='Пробует',icon='star',
 goal='Make tangible progress and understand a strength.',
 actions='Completes a short evidence-based exercise; connects action to outcome.',
 touch='First task, answer feedback, progress checklist, preparation material.',
 emotion='Effort → confidence',score=59,
 pain='Blank-page anxiety. Too much preparation content at once.',
 opportunity='One five-minute task; example answer; retry without penalty.',
 measure='Task starts → first completions'),
 dict(title='Conversion',ru='Получает ценность',icon='check',
 goal='Trust the plan enough to continue preparing.',
 actions='Returns to the plan after the first completed task; sees saved progress.',
 touch='Free plan confirmation, task success state, home progress card.',
 emotion='Accomplished',score=84,
 pain='Mistaking activation for a submitted application or admission assurance.',
 opportunity='State exactly what is saved. Separate checklist progress from admission odds.',
 measure='Activated users → first value'),
 dict(title='Retention',ru='Возвращается',icon='calendar',
 goal='Keep a manageable rhythm and meet verified deadlines.',
 actions='Returns for the next task; adjusts pace; uses optional bot reminders.',
 touch='Home, profile, bot messages, verified dates; calendar export later.',
 emotion='In control',score=77,
 pain='Missed dates; stale guidance; notification overload; Telegram unavailable.',
 opportunity='Source + verification date on deadlines; pause reminders; printable checklist.',
 measure='Activated cohort → day-7 return'),
 dict(title='Advocacy',ru='Рекомендует',icon='share',
 goal='Help another applicant without exposing personal information.',
 actions='Shares a public app link after a useful milestone; optionally gives feedback.',
 touch='Profile share action, Telegram share sheet, peer conversation.',
 emotion='Proud and helpful',score=92,
 pain='Unwanted exposure of progress or résumé; pressure to invite friends.',
 opportunity='Opt-in sharing of a neutral link; no private data; no referral gate.',
 measure='Shared links → new activations')
]
paths={'spark':'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z','arrow':'M4 12h16m-6-6 6 6-6 6','file':'M5 3h9l5 5v13H5Zm9 0v6h5M8 13h8m-8 4h6','star':'m12 3 3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1Z','check':'m5 12 4 4L19 6','calendar':'M3 5h18v16H3ZM7 3v4m10-4v4M3 11h18','share':'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8'}
def icon(name):
 return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="{paths[name]}"/></svg>'
base='''*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#17141f;background:#f6f5f9}h1,h2,h3,p{margin:0}'''
cjm_css=base+'''
.sheet{width:2400px;padding:64px 64px 38px}.heading{display:flex;justify-content:space-between;gap:70px;align-items:flex-start;margin-bottom:38px}.brand{font-size:20px;color:#4b32df;margin-bottom:16px}h1{font-size:57px;letter-spacing:-2px;font-weight:650;line-height:1.1}.intro{font-size:20px;color:#666072;line-height:1.5;margin-top:14px;max-width:1280px}.persona{width:540px;background:white;border:1px solid #ddd9e7;border-radius:20px;padding:24px;font-size:18px;line-height:1.5}.persona b{display:block;margin-bottom:8px}.grid{display:grid;grid-template-columns:150px repeat(7,1fr);gap:10px}.stage{background:#4b32df;color:white;border-radius:18px;padding:22px 17px;min-height:145px}.stage:nth-child(2),.stage:nth-child(3),.stage:last-child{background:#201b30}.stage-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;font-size:16px;color:#e5dfff}.stage svg{width:25px;height:25px;color:#f3a064}.stage h2{font-size:24px;letter-spacing:-.5px;margin-bottom:5px}.stage p{font-size:16px;color:#e5dfff}.label{display:flex;align-items:center;font-size:18px;font-weight:600;color:#686173}.cell{border-radius:14px;padding:19px 17px;background:white;font-size:18px;line-height:1.45;min-height:128px}.row{margin-top:10px}.touch{background:transparent;border:1px dashed #bcb2d6}.pain{background:#fce8d9;color:#6c3515}.opportunity{background:#e9e3ff;color:#36206e}.measure{font-size:16px;min-height:78px;background:#fff}.emotion{grid-column:span 7;position:relative;height:150px;background:white;border-radius:16px;overflow:hidden}.emotion svg{position:absolute;left:0;top:0;width:100%;height:150px}.emotion-labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr)}.emotion-labels span{text-align:center;font-size:15px;font-weight:600;align-self:end;padding:0 3px 15px}.foot{display:flex;justify-content:space-between;align-items:flex-start;gap:80px;margin-top:26px;font-size:17px;line-height:1.5;color:#696174}.legend{display:flex;gap:24px;white-space:nowrap}.key{display:inline-block;width:13px;height:13px;border-radius:4px;margin-right:7px}.note{max-width:1190px;font-size:16px}.caption{margin-top:22px;padding-top:20px;border-top:1px solid #ddd9e7;display:flex;justify-content:space-between;font-size:15px;color:#696174}
'''
body='<div class="sheet"><div class="heading"><div><p class="brand">SK Fast Track / Product experience</p><h1>A clear first step. A reason to return.</h1><p class="intro">Customer journey for an independent, free Telegram guide to Skolkovo grant preparation.<br>Onboarding creates the plan; the first completed task creates value.</p></div><div class="persona"><b>Applicant, not yet a confident candidate</b>Senior student or early-career professional in Russia. Wants a grant, has limited time, and needs a credible route through scattered information.</div></div>'
body+='<div class="grid"><div></div>'+''.join(f'<div class="stage"><div class="stage-top"><span>0{i+1}</span>{icon(s["icon"])}</div><h2>{s["title"]}</h2><p>{s["ru"]}</p></div>' for i,s in enumerate(stages))+'</div>'
for key,label in [('goal','User goal'),('actions','Actions'),('touch','Touchpoints')]:
 body+='<div class="grid row"><div class="label">'+label+'</div>'+''.join(f'<div class="cell {key}">{s[key]}</div>' for s in stages)+'</div>'
points=[(150+i*300,116-s['score']*.78) for i,s in enumerate(stages)]
body+='<div class="grid row"><div class="label">Emotions</div><div class="emotion"><svg viewBox="0 0 2100 150" preserveAspectRatio="none"><path d="M0 90H2100" stroke="#e5e1eb" stroke-dasharray="5 5"/><polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+'" fill="none" stroke="#4b32df" stroke-width="3"/>'+''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="'+('#f3a064' if i in [1,3] else '#4b32df')+'" stroke="white" stroke-width="3"/>' for i,(x,y) in enumerate(points))+'</svg><div class="emotion-labels">'+''.join(f'<span>{s["emotion"]}</span>' for s in stages)+'</div></div></div>'
for key,label in [('pain','Pain points'),('opportunity','Opportunities'),('measure','Measure')]:
 body+='<div class="grid row"><div class="label">'+label+'</div>'+''.join(f'<div class="cell {key}">{s[key]}</div>' for s in stages)+'</div>'
body+='''<div class="foot"><div class="legend"><span><i class="key" style="background:#4b32df"></i>Product opportunity / momentum</span><span><i class="key" style="background:#f3a064"></i>Friction / uncertainty</span><span><i class="key" style="background:#201b30"></i>Ecosystem touchpoint</span></div><p class="note">Emotion curve is a design hypothesis, not research data. Validate through applicant interviews and usability sessions. Conversion means first value in the free product; application submission remains external.</p></div><div class="caption"><span>Adapted from the supplied CJM and home-screen reference · Review concept v1</span><span>Free plan activation occurs before the core task. Conversion is measured after task completion.</span></div></div>'''
(OUT/'cjm.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>SK Fast Track · Customer journey</title><style>{cjm_css}</style>{body}</html>')

screens=[('entry','A welcoming first step','Value and trust before any questions'),('track','Choose a goal','Step 1 / one decision'),('schedule','Set a realistic pace','Step 2 / optional reminders'),('review','Review the free plan','Step 3 / no payment barrier'),('success','Confirm activation','Clear next action; no submission claim'),('home','See the next step','Checklist progress with a useful task'),('task','Experience first value','Concrete example, feedback and retry'),('profile','Stay in control','Edit preferences, privacy and sharing')]
for theme in ['light','dark']:
 dark=theme=='dark'
 css=base+f'''body{{background:{'#211e2a' if dark else '#efedf5'};color:{'#faf8ff' if dark else '#1c172b'}}}.board{{width:1840px;padding:55px 65px}}.top{{display:flex;justify-content:space-between;align-items:end;margin-bottom:42px}}h1{{font-size:46px;letter-spacing:-1.6px;font-weight:650}}.top p{{font-size:17px;margin-top:12px;color:{'#beb4d0' if dark else '#736981'}}}.pill{{border:1px solid {'#60546f' if dark else '#cfc5de'};padding:12px 18px;border-radius:30px;font-size:15px}}.screens{{display:grid;grid-template-columns:repeat(4,390px);gap:38px 50px}}figure{{margin:0}}figure img{{display:block;width:390px;height:844px}}figcaption{{margin:18px 0 0 4px;font-size:17px;font-weight:650}}figcaption small{{display:block;margin-top:7px;font-size:13px;color:{'#beb4d0' if dark else '#736981'};font-weight:400}}.bottom{{margin-top:36px;padding-top:22px;border-top:1px solid {'#4b415c' if dark else '#d6cfe2'};display:flex;justify-content:space-between;font-size:14px;color:{'#beb4d0' if dark else '#736981'}}}'''
 board=f'<div class="board"><div class="top"><div><h1>SK Fast Track. A plan you can start.</h1><p>Russian UI · Telegram Mini App · Onboarding and first-value journey</p></div><span class="pill">{theme.capitalize()} theme / 8 screens</span></div><div class="screens">'
 board+=''.join(f'<figure><img src="screens/{theme}-{s}.png" alt="{title}"><figcaption>{i+1:02d} / {title}<small>{desc}</small></figcaption></figure>' for i,(s,title,desc) in enumerate(screens))
 board+='</div><div class="bottom"><span>Violet focus · apricot milestones · quiet, rounded surfaces</span><span>Telegram chrome simulated for review. Home uses illustrative returning-user progress.</span></div></div>'
 (OUT/f'mockups-{theme}.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>SK Fast Track · {theme} mockups</title><style>{css}</style>{board}</html>')

css=base+'''.sheet{width:1600px;padding:60px}h1{font-size:48px;letter-spacing:-1.5px}.lead{color:#70667e;font-size:19px;line-height:1.5;margin-top:12px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:38px}.panel{background:white;border:1px solid #e0dae9;border-radius:24px;padding:28px}h2{font-size:24px;margin-bottom:22px}.swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.swatch i{display:block;height:68px;border-radius:12px;margin-bottom:9px}.swatch b{font-size:14px;display:block}.swatch span{font-size:12px;color:#6c6978;display:block;margin-top:4px}.sample{padding:18px 0;border-bottom:1px solid #e5e0eb}.sample:last-child{border:0}.sample small{display:block;color:#777080;font-size:13px;margin-top:8px}.tokens{display:flex;align-items:end;gap:17px;margin-top:22px}.tokens span{display:block;text-align:center;font-size:12px;color:#70667e}.tokens i{display:block;background:#4b32df;border-radius:4px;margin:0 auto 8px}.component{border:1px solid #e3e1e9;border-radius:16px;padding:18px;margin:14px 0;font-size:15px}.button{background:#4b32df;color:white;border:0;text-align:center;font-weight:650;min-height:50px;display:grid;place-items:center}.disabled{background:#e3e1e9;color:#6c6978}.selected{background:#ede9ff;border:2px solid #4b32df;color:#4b32df}.note{font-size:14px;color:#6c6978;line-height:1.6}.contrast{background:#17161e;color:#f7f5fc;border:1px solid #393544}.contrast span{color:#c0afff}.foot{margin-top:28px;display:flex;justify-content:space-between;color:#70667e;font-size:14px;border-top:1px solid #ddd7e7;padding-top:20px}'''
palette=[('Focus violet','#4B32DF','Primary action / progress'),('Apricot','#F3A064','Milestone / deadline'),('Paper','#F6F6F8','Light canvas'),('Ink','#14131A','Primary text'),('Lavender','#EDE9FF','Selection surface'),('Slate','#6C6978','Secondary text')]
body='<div class="sheet"><h1>One familiar identity. Two native themes.</h1><p class="lead">Reference-derived palette and rounded geometry, with readable type and explicit interaction states.<br>Approximate visual samples; source PDFs contain no editable font metadata.</p><div class="columns"><div><div class="panel"><h2>Color roles</h2><div class="swatches">'+''.join(f'<div class="swatch"><i style="background:{hex}"></i><b>{n}</b><span>{hex}</span><span>{role}</span></div>' for n,hex,role in palette)+'</div><div class="component contrast">Dark surfaces: #17161E / #22212C<br><span>Accent text: #C0AFFF</span> · CTA: #6347DF</div><p class="note">Apricot is a highlight, never small text on white. Dark mode uses brighter accent text and a separate CTA fill.</p></div><div class="panel" style="margin-top:24px"><h2>Space and shape</h2><p class="note">4px base unit · 20px content gutter · 10–12px card gaps<br>12–18px control radius · 22px hero radius · 44px minimum hit area</p><div class="tokens">'+''.join(f'<span><i style="width:{n}px;height:{n}px"></i>{n}</span>' for n in [4,8,12,16,20,24,32,48])+'</div></div></div><div><div class="panel"><h2>Typography with a clear job</h2><div class="sample" style="font-size:32px;font-weight:700;letter-spacing:-.8px">Понятный первый шаг<small>Display / 32px / 1.12 / semibold</small></div><div class="sample" style="font-size:21px;font-weight:650">Ваш план подготовки<small>Section / 21px / 1.2 / semibold</small></div><div class="sample" style="font-size:14px">Одна небольшая задача за раз.<small>Body / 14–16px / 1.5 · caption / 12px minimum in production</small></div><p class="note" style="margin-top:18px">System UI: SF on Apple, Segoe UI on Windows, platform sans-serif fallback. Cyrillic support is required.</p></div><div class="panel" style="margin-top:24px"><h2>Components and states</h2><div class="component button">Активировать бесплатный план</div><div class="component selected">◉ &nbsp; Конкурс грантов — selected choice</div><div class="component button disabled">Проверить ответ — disabled until selected</div><p class="note">Visible focus ring · text feedback for errors · opt-in switches.<br>Native MainButton replaces the preview footer in Telegram; native BackButton follows navigation history.</p></div></div></div><div class="foot"><span>Tokens derived from the provided home and CJM; dark palette is a new extension.</span><span>Theme colors are runtime inputs. Validate custom Telegram themes too.</span></div></div>'
(OUT/'design-system.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>SK Fast Track · Design system</title><style>{css}</style>{body}</html>')
print('Built CJM, light/dark boards and design system HTML')
