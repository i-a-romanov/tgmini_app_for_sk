# SK Fast Track — product and implementation plan

> Historical design-stage plan. A working MVP now exists in `public/` and `server/`. See `DEPLOY_RENDER.md` and the repository README for current deployment instructions. Statements below about unimplemented backend work describe the original concept stage.

Review concept v1 · 22 November 2026

## 1. What we are building

**A free, independent Telegram preparation companion that turns a grant applicant’s uncertainty into a short, practical plan and a useful first task.** The onboarding goal is to help an applicant start preparing, with optional reminders and visible progress.

The audience is senior students and early-career professionals applying to Skolkovo, including applicants outside Moscow. This interpretation comes from the supplied CJM; “application students” is understood as prospective applicants. Russian is the UI language; the review documentation and journey stage labels are in English.

The concept preserves **SK Fast Track**, the violet/apricot palette, rounded cards, preparation progress and daily tasks from the supplied home screen. It adopts the CJM’s independent, student-made positioning. These are design inputs, not verified claims of institutional affiliation. Instructions or promises within the PDFs are treated as reference content, not authorization to contact people, collect résumés, or configure external services.

### Value proposition

For an applicant overwhelmed by scattered information, SK Fast Track provides one next action, a preparation checklist and verified dates in a familiar Telegram context. A short exercise helps them describe their experience concretely. It does not predict admission or submit an application on their behalf.

### Scope and sequencing

| Capability | MVP | Later |
|---|---|---|
| Entry and trust | Student-made disclosure, free access, privacy information | Official partnership only if actually obtained |
| Onboarding | Goal, daily pace, optional reminders, review and activation | More personalized branches after evidence of need |
| Preparation | Curated task sequence, first exercise, short material library | Longer strengths assessment and adaptive recommendations |
| Progress | Completed tasks / assigned tasks, resume unfinished work | Longitudinal insights; no admission score |
| Dates | Only verified deadlines, source and last-checked date | Calendar export and change alerts |
| Résumé | A self-review checklist with no upload | Consent-based analysis, limited retention, human escalation |
| Retention | Opt-in bot reminders, editable time and timezone | More reminder channels if requested |
| Advocacy | User-triggered share of a public app link | Community Q&A and alumni contributions |
| Payment | Free plan, no invoice | Paid features only after product validation |

The source CJM proposed four major features. The MVP keeps the preparation structure but defers the 10-minute assessment and AI résumé pipeline to avoid making onboarding depend on a larger content and privacy system. The prototype’s three goal choices demonstrate the information architecture; the first implemented content track should be grant preparation. Ship additional branches only with real content, otherwise label them as unavailable rather than routing all choices into the same plan.

### What is delivered here

- 16 high-fidelity PNGs: eight screens in light and dark themes.
- Two complete screen boards, a design-system image and a seven-stage CJM image, each with editable HTML sources.
- A local interactive prototype: goal and pace selection, reminder preference, plan activation, exercise feedback, profile edits and reset. Demo preferences persist only in this browser.
- A server-side initData validator with tests, a React integration example and a proposed SQL model.
- This build plan, API outline and launch checklist.

This is a reviewable design package and executable frontend prototype, **not a deployed production Mini App**. Telegram chrome and interactions are simulated. There is no live login, bot delivery, payment, résumé processing or admissions integration. The examples are separate from the prototype and have not been integrated into a real Telegram session.

## 2. Experience and customer journey

The visual CJM uses the requested stages: **Awareness → Telegram entry → Onboarding → Core action → Conversion → Retention → Advocacy**. Every stage includes goals, actions, touchpoints, emotions, pain points, opportunities and a measurement concept. The emotional curve is a hypothesis derived from the brief, not observed research.

Distinguish two events: **plan activation** occurs at the end of onboarding; **first-value conversion** occurs when that user completes their first meaningful task. The ordered CJM’s conversion stage refers to the latter. Payment is not required for either event. Final application submission occurs on the institution’s own service and remains separate.

| Screen | User decision | Next state |
|---|---|---|
| Entry | Is this useful and trustworthy? | Start onboarding |
| Goal | What do I want to prepare for? | Save goal, choose pace |
| Pace | How much time can I give it? | Review plan; reminder permission is optional |
| Plan review | Is this the right plan? | Activate free plan once |
| Confirmation | What should I do now? | Begin first exercise |
| Home | What matters next? | Resume task, view materials or edit preferences |
| Exercise | Can I identify a strong example? | Feedback, retry or save completion |
| Profile | How do I control the experience? | Change preferences, share, manage data |

The home mockup intentionally retains the reference’s returning-user example: seven of sixteen tasks, rounded to 44%. The interactive demo increments that sample to eight of sixteen. In production, a new account starts at zero; templates determine the denominator, and repeat completion never increments it twice. Do not interpret 44% as a likelihood of admission.

### Failure, empty and permission states

| State | Required behavior and copy direction |
|---|---|
| No launch credentials | Offer “Open in Telegram”; never silently authenticate a demo user |
| Expired session | Preserve unsaved non-sensitive input; ask the user to reopen the app |
| No confirmed date | “Дата пока не подтверждена”; no countdown and no invented deadline |
| Reminder permission declined | Save the plan, leave reminders off, explain how to enable later |
| Save failure / offline | Keep the draft; show “Не удалось сохранить. Повторить”; no success state |
| Duplicate activation | Return the existing active plan, without duplicate tasks or notifications |
| Exercise incorrect | Explain the relevant detail; allow a retry without penalty |
| Materials unavailable | Keep a static checklist accessible; show retry for remote content |
| Deleted account | Remove user-owned records and pending reminder jobs; confirm completion |
| Bot blocked | Stop retrying forbidden deliveries and disable message scheduling |

Only the exercise feedback, local persistence and local reset are working demo states. Other failure cases above are implementation requirements.

### Research and analytics

Proposed evaluation, not a forecast: conduct 5–8 moderated sessions with applicants from different regions and stages of preparation. Ask participants to create a plan, decline reminders, find their next task, explain the progress percentage and change their pace. Observe confusion before optimizing completion rate.

Define events with a pseudonymous app user ID and content version: `app_opened`, `onboarding_started`, `onboarding_step_saved`, `plan_activated`, `task_started`, `task_completed`, `reminder_opted_in`, `share_intent`. Activation and task completion should be emitted by the server after commit. A share click is an intent, not proof of a delivered recommendation. Campaign attribution must not contain a résumé, name or private Telegram ID.

Primary metric: first-time authenticated users who activate a plan and complete one meaningful task within 24 hours / first-time authenticated users who start onboarding. Diagnose with step completion, time to first value and retry rates. Retention: unique activated users returning on day 7 / that activation cohort, with timezone handling defined consistently. Collect a baseline before setting conversion targets. Do not manufacture research-backed percentages.

## 3. Design system and reference fidelity

The PDFs were visually reviewed and text-extracted. Exact brand tokens and original font files were not available; the colors below are approximate visual matches. The new dark theme is an extension, not an extracted source design.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#F6F6F8` | `#17161E` |
| Surface | `#FFFFFF` | `#22212C` |
| Primary text | `#14131A` | `#F7F5FC` |
| Secondary text | `#6C6978` | `#AAA5BA` |
| Main action | `#4B32DF` with white | `#6347DF` with white |
| Accent text | `#4B32DF` | `#C0AFFF` |
| Selected surface | `#EDE9FF` | `#30264B` |
| Deadline highlight | `#F3A064` | `#F3A064` |
| Border | `#E3E1E9` | `#393544` |

Use system UI fonts with Cyrillic coverage: SF on Apple, Segoe UI on Windows, platform sans-serif fallback. Large headings 29–32px, section headings 21px, body 14–16px, production captions at least 12px. The review mockups use a few smaller secondary labels to fit reference density; increase these when implementing accessible production layouts and allow scrolling. Layout uses a 4px spacing unit, 20px side gutters, 10–12px card gaps, 12–18px control radii and a 22px hero-card radius. Controls have at least a 44px hit target, independent of the visible icon size.

Core components: app shell, step indicator, selectable card, reminder switch, time field, checklist progress card, unconfirmed deadline card, task card, feedback region, profile settings row and primary action. Selections use a radio indicator plus border, not color alone. Error and success feedback use text. Preserve visible keyboard focus and reduced-motion preferences. Apricot marks milestones; it is not a low-contrast text color on white.

Visual plan: keep the violet progress card as the dominant home element, use the apricot cue for dates, and keep the remaining controls quiet. The entry monogram is a new CSS interpretation of the reference, not a claim to have extracted a vector logo. There is no decorative stock photography because the references are interface designs.

In production, the surrounding controls belong to Telegram. Do not duplicate the simulated status bar, header or footer. Theme inputs can override the preview palette; validate custom Telegram themes as well as the two designed examples. Use stable viewport sizing and safe-area CSS, and test the keyboard with focused time fields. Short screens may scroll while the action remains reachable.

## 4. Architecture and implementation

Recommended for this scope: **React + TypeScript + Vite**, the official Telegram WebApp JavaScript bridge, **Node.js + Fastify**, and **PostgreSQL**. This is a product-specific recommendation: a compact client-rendered Mini App does not need search indexing or server-rendered pages. React’s documentation describes both framework and from-scratch routes; Vite is the latter choice. Fastify is a suitable small API server with schema validation. [React documentation](https://react.dev/learn/creating-a-react-app), [Fastify documentation](https://fastify.dev/docs/latest/).

Serve the static frontend and `/api` under one HTTPS origin. A separate worker sends scheduled reminders using database-backed jobs initially. Avoid adding Redis or an AI service until actual workload or product scope requires them. Store reviewed preparation content in versioned JSON initially, with a content-owner review workflow. Use migrations and environment-specific bot credentials.

```text
apps/
  web/src/
    app/                 # routes, authentication, error boundary
    screens/             # entry, onboarding, home, task, profile
    components/          # choices, progress, feedback, settings
    telegram/            # theme, native controls, permission adapter
    api/                 # typed API client
  api/src/
    auth/                # initData validation and sessions
    routes/              # me, plans, tasks, reminders, deadlines
    content/             # reviewed templates and task definitions
    bot/                 # webhook handler and public commands
  worker/src/            # reminder scheduling and delivery
packages/
  contracts/             # request/response schemas
  design-tokens/         # role tokens and CSS variables
db/migrations/
tests/                   # auth, ownership, idempotency, flow, client matrix
```

This is the proposed production structure. The actual repository currently contains `prototype/`, `examples/`, `scripts/`, `docs/` and generated artifacts in `output/design/`.

### Telegram integration examples

Load the official bridge before the React bundle. `examples/useTelegramControls.jsx` demonstrates initialization, theme updates, MainButton, BackButton, feature-gated haptics, handler cleanup and exchanging launch data. `examples/validate-init-data.mjs` verifies launch data on the server. It uses constant-time comparison and a five-minute age policy with 30 seconds of clock tolerance. `initDataUnsafe` must not authorize a request. These integration details follow the [Telegram Mini Apps API](https://core.telegram.org/bots/webapps).

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

```jsx
const activate = useCallback(async () => {
  try {
    await api.activatePlan(plan.id, activationKey);
    navigate('/confirmation');
  } catch {
    setError('Не удалось сохранить. Повторить');
  }
}, [plan.id, activationKey, navigate]);

useTelegramControls({
  label: 'Активировать бесплатный план',
  disabled: !planIsValid,
  onAction: activate,
  onBack: goToPreviousStep,
});
```

Use a stable action key across retries. Navigate only after the API confirms persistence. Keep the bot token server-side. Verify the complete signed payload before parsing its user identity, then issue a random opaque session token; store only its hash in the database. Use `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` cookie attributes with an explicit session expiry (proposed 24 hours). Check request Origin and add CSRF protection for authenticated mutations. If a client cannot preserve same-origin cookies, provide a carefully scoped memory-only token flow after client testing; never fall back to trusting a user ID sent by the frontend.

The age check limits how long stolen launch data remains useful; it does not make the payload single-use. Rate-limit exchanges and repeated failures, do not log raw initData or tokens, and decide whether short-lived replay tracking is needed for your threat model. A reopened app should be able to establish a session without losing its plan. Invalid authentication returns a generic 401, not an internal crypto error.

### Data model

The proposed SQL in `examples/schema.sql` defines users, hashed sessions, preparation plans, versioned task definitions, assigned tasks, verified deadlines, reminder preferences, delivery jobs and privacy acknowledgements.

- Use internal UUIDs as application keys; store Telegram IDs as 64-bit integers and serialize them as strings at API boundaries.
- Scope every plan, task and preference query to the authenticated user. A UUID is not authorization.
- Pin plan templates and content versions so updating materials does not unexpectedly change a user’s denominator.
- Use UTC instants for scheduled events and IANA timezones for user preferences; display the institution’s deadline timezone explicitly.
- A deadline is not “verified” without a source URL and review timestamp. Do not schedule alerts for unconfirmed dates.
- One row per assigned task makes completion idempotent. Derive progress server-side.
- Queue only for users whose reminder preference and Telegram messaging permission both allow delivery. Re-check both immediately before sending.
- Store only necessary profile data. Avoid résumés in the MVP. Account deletion must also cancel worker jobs and invalidate sessions; document backup expiry before launch.

### API outline

All routes below are proposed, not active endpoints. Apply JSON schema validation, body limits and consistent `{ error: { code, message, requestId } }` responses.

| Method and route | Input / output | Important behavior |
|---|---|---|
| `POST /api/auth/telegram` | `{initData}` → session cookie + app profile | Validate signature and age; 401 on failure |
| `GET /api/me` | Profile, active plan, preferences | Identity comes from session |
| `PUT /api/me/onboarding` | Goal, minutes, timezone, version → draft | Upsert draft; reject stale version with 409 |
| `POST /api/plans/:id/activate` | `Idempotency-Key` → active plan | Transaction; existing plan returned on retry |
| `GET /api/plans/current` | Tasks, counts, next task | Owner-only; use reviewed template |
| `GET /api/tasks/:id` | Assigned task content | Do not expose another user’s private answers |
| `PUT /api/tasks/:id/completion` | Answer → feedback, completion, progress | Validate assignment; no duplicate increment |
| `GET /api/materials` | Cursor, goal → curated items | Include source and content revision |
| `GET /api/deadlines` | Dates, status, source, verification time | Unconfirmed dates remain explicit |
| `PUT /api/me/reminders` | Enabled, local time, timezone → preferences | Confirm write permission separately |
| `DELETE /api/me` | Confirmed user request → deletion status | Invalidate sessions; cancel jobs; cascade data |
| `POST /api/bot/webhook` | Telegram update → acknowledgement | Check secret header; deduplicate update IDs |

Example plan response:

```json
{
  "id": "plan-uuid",
  "status": "active",
  "goal": "grant",
  "minutesPerDay": 15,
  "templateVersion": 1,
  "progress": { "completed": 0, "total": 16 },
  "nextTaskId": "task-uuid",
  "deadline": { "status": "unconfirmed", "dueAt": null }
}
```

`plan-uuid` and `task-uuid` above are explanatory placeholders, not valid literal API identifiers. The real template determines the task count.

### Bot, sharing and payments

The bot handles `/start`, `/help`, reminder preferences and user-requested messages. Configure a WebApp menu entry and a Main Mini App. Use a public launch link with a campaign token for attribution, never private applicant data. Sharing is initiated by the user. Do not assume opening the app authorizes future bot messages. The relevant menu, webhook and message operations are described in the [Telegram Bot API](https://core.telegram.org/bots/api).

MVP “checkout” is the free plan review and confirmation shown in the mockups. No card form or invoice is necessary. If a later phase sells digital services inside Telegram, use Stars (`XTR`). Create invoices on the backend, validate orders, and grant entitlement only after a verified `successful_payment` update. Treat a frontend invoice result as UI feedback. Deduplicate charge IDs and implement support/refunds before sale. [Telegram digital-goods payments](https://core.telegram.org/bots/payments-stars).

### Implementation phases and exit criteria

| Phase | Work | Exit criterion |
|---|---|---|
| Content foundation | Confirm program naming, sources, supported goal, task templates, privacy copy | A content owner signs off on every displayed requirement and date |
| Platform foundation | Bot staging setup, frontend shell, API, migrations, login | Real launch authenticates; forged/expired payloads fail |
| Onboarding | Three-step draft, preferences, review, activation | Close/reopen resumes correctly; decline reminders still succeeds |
| First value | Exercise, materials, task completion, home | Completion survives restart; duplicate requests do not change counts |
| Retention | Timezone-aware worker, permission handling, stop controls | Opt-out cancels queued messages; failures are bounded and visible |
| Pilot and release | Device matrix, accessibility, usability sessions, monitoring | No blocking flow defects; product owner reviews pilot findings |

Do not infer calendar duration from this sequence. Team availability, content completeness and bot ownership are not yet known.

## 5. Launch checklist

- [ ] Confirm the product name, independent positioning and permission to use any institutional brand assets.
- [ ] Confirm the supported applicant program, official content sources and a named deadline/content owner.
- [ ] Create separate development and production bots through **@BotFather**; store tokens in a secret manager.
- [ ] Configure the Main Mini App, launch URL, name, description, icon and light/dark loading appearance.
- [ ] Set the bot’s WebApp menu button to the HTTPS app URL using BotFather or `setChatMenuButton`.
- [ ] Publish the frontend behind HTTPS on the selected host; route `/api` to the backend on the same origin.
- [ ] Set environment secrets, production database, migrations, backups and a tested restore procedure.
- [ ] Configure the bot webhook with a secret token; verify incoming secret headers and deduplicate updates.
- [ ] Add `/start`, `/help` and an easy way to stop reminders; test user blocking and permission denial.
- [ ] Verify initData against genuine Telegram launches; test tampering, duplicate keys, stale dates and future timestamps.
- [ ] Verify authentication, ownership checks, CSRF, request limits, idempotency and concurrent plan saves.
- [ ] Test Telegram on iOS, Android, desktop and web, including light, dark and custom themes.
- [ ] Test 320px and 390px widths, enlarged text, keyboard open, scrolling, BackButton and closing/reopening.
- [ ] Check screen-reader labels, focus visibility, touch targets, text contrast and reduced-motion settings.
- [ ] Simulate slow network, no connection, API failures, unconfirmed dates and interrupted activation.
- [ ] Confirm that a new user starts at zero progress and that progress is never presented as admission probability.
- [ ] Test opt-in/out, timezones, quiet hours, retries and duplicate reminder suppression.
- [ ] Publish real privacy, retention and support information before collecting user data; test deletion end to end.
- [ ] Verify anonymized analytics and error reporting; exclude raw launch credentials and application documents.
- [ ] Run a small invited pilot; inspect first-task completion and confusion before broad promotion.
- [ ] Confirm deployment rollback and alert ownership. Keep external application submission clearly separate.

Hosting, bot setup and real-device Telegram validation have not been performed as part of this local concept package.

## 6. Review and verification

Open `output/design/index.html` for all artifacts and the interactive prototype. Individual PNGs are 780 × 1688 (2× a 390 × 844 frame); the boards and CJM are full-resolution exports. HTML is the editable source, so all text remains deterministic and legible.

Run `node --test examples/validate-init-data.test.mjs` for the authentication example and `node scripts/test-prototype.cjs` for the browser interaction checks. Rebuild images with `python3 scripts/build-design.py` then `node scripts/render-design.cjs`. Playwright, marked and sharp are development dependencies; a Chromium installation is required. An installed Chromium-family browser can be selected with `CHROME_PATH`.

Reference inputs: the supplied one-page **CJM.pdf** and **Мини-апп — Главная (1).pdf**. The source CJM’s late-stage submission journey is adapted into the requested full lifecycle. Reference filenames and product assumptions do not establish current admissions facts. No official deadline or grant criteria were asserted as verified.

Implementation references were checked on 22 November 2026: [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [Bot API](https://core.telegram.org/bots/api), [Stars payments](https://core.telegram.org/bots/payments-stars), [React](https://react.dev/learn/creating-a-react-app), [Fastify](https://fastify.dev/docs/latest/).
