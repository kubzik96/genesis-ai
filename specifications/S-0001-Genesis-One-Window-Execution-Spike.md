# S-0001 — Genesis One-Window Execution Spike

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0001 |
| **Название** | Genesis One-Window Execution Spike |
| **Статус** | **Approved** (Revision 3) |
| **Revision** | **3** |
| **Автор Revision 1** | Grok — Chief Architect |
| **Автор Revision 2** | Grok — execution agent under S-0004 PR A EA |
| **Автор Revision 3** | ChatGPT — COO, по поручению CEO и итогам архитектурного review Grok |
| **Дата создания** | 2026-07-24 |
| **Дата утверждения Revision 1** | 2026-07-24 |
| **Дата утверждения Revision 2** | 2026-08-07 |
| **Дата подготовки Revision 3 Draft** | 2026-08-11 |
| **Дата утверждения Revision 3** | 2026-08-11 |
| **Утвердил Revision 1** | CEO Genesis AI |
| **Утвердил Revision 2** | CEO Genesis AI |
| **Утвердил Revision 3** | CEO Genesis AI |
| **Execution Authorization** | **NOT_GRANTED для Revision 3**. Исторические Stages 1–4 Revision 1/2 сохраняются; нового blanket EA нет. |
| **Связанные задачи** | T-009 — Genesis One-Window Execution Spike |
| **Связанные Decision Records** | DR-0004; DR-0007 (Accepted) |
| **Related Specifications** | [S-0005](S-0005-Genesis-Limited-Grok-Executor-Path.md) (Approved — limited Grok/xAI executor path); [S-0004](S-0004-Post-Stage-4-Source-of-Record-Synchronization-Governance-Correction.md) (Approved R1 — authoritative for SoR sync); [S-0003](S-0003-Post-Stage-4-Source-of-Record-Synchronization.md) (Revision 1 — **Superseded**) |
| **Исполнитель (после Authorization)** | Integration Engineer / Lead Engineer (по stage; см. §13) |

> **Revision 3 = Approved** (2026-08-11) CEO Genesis AI.
>
> **Execution Authorization для Revision 3 остаётся NOT_GRANTED.**
>
> Approval документации не разрешает реализацию, deployment, secrets operations или smoke.
>
> Revision 2 history and Stage 4 PARTIAL PASS preserved.
>
> **Не было** и **нет** единого общего Execution Authorization «на весь S-0001».  
> Каждый Stage / live write выполняется только после **отдельного** CEO Authorization.  
> **Stage 4 result:** **PARTIAL PASS** — см. §13.  
> SoR synchronization после Stage 4 выполняется по **Approved S-0004 Revision 1**.  
> Revision 3 фиксирует границу продолжения через S-0005; исходные критерии One-Window не ослаблены.

### Предлагаемое изменение Revision 3

Revision 3 не переписывает исторический Copilot spike и не выдаёт его за PASS. Она фиксирует границу продолжения:

- Copilot Cloud Agent path недоступен на текущем бесплатном плане и остаётся историческим `PARTIAL PASS`;
- цель CEO — убрать ручное копирование между ChatGPT, Grok и GitHub — сохраняется;
- новый ограниченный Grok/xAI executor path описывается отдельно в **S-0005**, потому что это major scope change;
- S-0002 Revision 1 не расширяется молча: новый write-contract требует отдельной Specification, тестов, review, CEO Approval и staged Execution Authorization;
- первый Grok smoke обязан остановиться на `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW` и не считается полным One-Window PASS;
- Grok не может быть единственным independent reviewer собственной реализации;
- никакого merge endpoint, auto-merge, direct `main` write или постоянного разрешения на GitHub write не появляется.

---

## 1. Контекст

Genesis AI уже имеет:

- Constitution, Development Workflow, Decision Records;
- Bridge (QUEUE / HANDOFF) как операционное состояние;
- Approved Specifications Repository (DR-0004);
- закрытые T-001, T-007, T-008;
- T-006 (custom Orchestrator) в статусе BLOCKED.

CEO подтвердил цель: как можно быстрее перейти к работе **в одном окне** (телефон + ПК) без постоянного копирования команд между ChatGPT, Grok, Copilot и GitHub.

Архитектурное направление принято:

**APPROVE OPTION C WITH SCOPE CORRECTIONS**

- Dify Cloud — временный Interaction + Orchestration MVP;
- GitHub — постоянный System of Record;
- Copilot — Engineer через GitHub Issue → PR (не как LLM внутри Dify);
- Planner / независимый Reviewer — через **минимум один** API-провайдер: OpenAI API **или** xAI API (второй optional);
- собственная Genesis Console и LangGraph **не входят** в S-0001;
- после spike — отдельное решение о долгосрочной платформе.

Проблема, которую решает S-0001: отсутствие проверяемого end-to-end цикла «одна команда CEO → Issue → Copilot PR → независимый review → решение CEO» в одном UI.

---

## 2. Цель

CEO с телефона или ПК формулирует одну небольшую реальную задачу в Dify.

Система должна:

1. загрузить утверждённый контекст из GitHub;
2. сформировать структурированный GitHub Issue;
3. передать Issue Copilot coding agent;
4. получить созданный PR;
5. загрузить фактические PR metadata, diff и статусы;
6. передать Git-артефакты независимой API-модели;
7. показать CEO результат review;
8. предоставить действия: **Approve** / **Request changes** / **Reject**;
9. **не** выполнять merge автоматически.

### Первый тестовый сценарий

Создать через единое окно Issue на одно изменение:

В `bridge/QUEUE.md` заменить битую последовательность в строке правил обновления на корректную букву «в»:

```text
QUEUE.md обновляется �� том же commit, что и результат работы.
→
QUEUE.md обновляется в том же commit, что и результат работы.
```

Copilot должен открыть PR **только** с этой правкой.  
Независимый reviewer должен проверить **фактический diff PR**.  
CEO должен принять решение из Dify **без** ручного копирования команд между чатами.

**Фактический итог Stage 4 (не definition of done):** целевой encoding-diff принят в `main` через Issue #19 и PR #20 (squash `99e6d153…`). Полный One-Window цикл без ручных шагов **не** достигнут → Stage 4 = **PARTIAL PASS**, не PASS. Исходные критерии успеха ниже **не** ослаблены.

---

## 3. Scope

### В Scope (разрешено)

- Dify Cloud Web App для телефона и ПК;
- один управляемый workflow;
- чтение из GitHub:
  - `bridge/QUEUE.md`;
  - `bridge/HANDOFF.md`;
  - `governance/Constitution.md`;
  - `governance/DevelopmentWorkflow.md`;
  - `specifications/INDEX.md`;
  - соответствующей Approved Specification (после Approval S-0001);
- создание структурированного GitHub Issue;
- назначение или запуск Copilot coding agent;
- ожидание и обнаружение PR;
- получение PR link, HEAD SHA, changed files, diff, mergeability и CI-статуса;
- независимый review через API-модель (на основе Git-diff, не пересказа);
- обязательные CEO checkpoints (см. §4);
- run history и статус текущего запуска;
- минимальная инструкция запуска с телефона;
- минимальный бюджет и hard limits API;
- хранение секретов только в защищённых настройках платформы (не в Git);
- экспортируемая документация конфигурации **без** секретов.

### Вне Scope (запрещено)

- auto-merge;
- merge без отдельного CEO Merge Authorization;
- собственная Genesis Console;
- LangGraph;
- разблокировка T-006;
- Agent Registry;
- несколько параллельных инженеров;
- production-grade CI;
- автоматическое исправление произвольных багов;
- широкие GitHub write-права;
- хранение токенов или API-ключей в репозитории;
- отказ от GitHub как System of Record;
- использование ChatGPT Plus / подписки Grok как API-доступа.

### Разрешённые изменения в репозитории при реализации (после Execution Authorization)

- только артефакты, необходимые для документации конфигурации spike (без секретов);
- тестовый PR по сценарию QUEUE encoding (отдельный цикл, не часть merge этой Specification).

### Запрещено изменять при реализации S-0001

- `governance/Constitution.md`;
- действующие Decision Records без отдельного DR;
- архитектуру Bridge;
- статус T-006 (остаётся BLOCKED);
- `main` напрямую.

---

## 4. Требования

### 4.1 Interaction

1. CEO открывает одно Web App окно Dify на Android и на ПК.
2. Workflow принимает текстовую формулировку задачи от CEO.
3. Система загружает актуальный контекст из `main` (read-only).

### 4.2 GitHub Issue

4. Структурированный Issue создаётся **только после** CEO confirmation (Gate 1).
5. Issue содержит: цель, scope, ограничения, acceptance criteria тестового сценария, ссылку на S-0001.
6. GitHub write-scope MVP ограничен созданием Issue и действиями, необходимыми для запуска Copilot.

### 4.3 Copilot Engineer

7. Issue передаётся Copilot coding agent **только после** CEO confirmation (Gate 2).
8. Copilot работает через GitHub (Issue → PR), **не** как LLM-узел внутри Dify.
9. Ожидается PR с ограниченным diff (для тестового сценария — только `bridge/QUEUE.md`).

### 4.4 PR observation

10. Dify получает: PR URL, HEAD SHA, список changed files, diff, mergeability, CI-статус (или `CI_NOT_CONFIGURED`).
11. Источник истины для review — **Git-артефакты**, не пересказ агента.

### 4.5 Independent review

12. Для независимого review требуется **минимум один** API-провайдер:
    - **OpenAI API** **или** **xAI API** (достаточно одного);
    - второй провайдер — **optional**;
    - **primary reviewer** выбирается на этапе **preflight** (какой ключ доступен и в бюджете).
13. Reviewer анализирует фактический diff и возвращает краткий verdict + замечания.
14. После review workflow останавливается (Gate 3).

### 4.6 CEO decision

15. CEO видит: ссылку на PR, краткий verdict review, кнопки:
    - **Approve**
    - **Request changes**
    - **Reject**
16. Значение кнопки **Approve**:
    - фиксирует кандидат-вердикт **`APPROVE_TO_MERGE`**;
    - **не** является CEO Merge Authorization;
    - **не** разрешает и **не** запускает merge;
    - merge по-прежнему требует отдельного CEO Merge Authorization вне этого workflow.
17. **Request changes** создаёт понятное продолжение workflow (без потери контекста).
18. Merge **не** выполняется из S-0001. Любое будущее merge-действие требует отдельного CEO Merge Authorization (Gate 4).

### 4.7 Security & operations

19. Секреты хранятся только в защищённых настройках платформы.
20. Секреты отсутствуют в GitHub, логах workflow и экспортируемой документации.
21. Установлены месячный бюджет и hard limits API; при исчерпании — остановка со статусом BLOCKED.

### 4.8 Обязательные CEO Gates

Workflow **обязан** останавливаться:

| Gate | Момент |
|---|---|
| 1 | Перед созданием GitHub Issue |
| 2 | Перед передачей задачи Copilot |
| 3 | После независимого review |
| 4 | Перед любым merge-действием |

---

## 5. Ограничения

- ChatGPT Plus ≠ OpenAI API; подписка Grok ≠ xAI API.
- Для review достаточно **одного** из: OpenAI API **или** xAI API; оба не обязательны.
- T-006 остаётся BLOCKED; S-0001 не является разблокировкой Orchestrator.
- Dify — временный MVP, не окончательная Execution Platform.
- Один тестовый сценарий на spike; произвольные задачи вне scope.
- CI может отсутствовать (`CI_NOT_CONFIGURED`) — это не «зелёный» результат.

---

## 6. Dependencies

- DR-0004 — Repository of Approved Specifications (принято);
- `governance/DevelopmentWorkflow.md` (T-007, в main);
- `bridge/QUEUE.md`, `bridge/HANDOFF.md`;
- доступность Dify Cloud;
- **минимум один** API-ключ: OpenAI API **или** xAI API (второй optional);
- Copilot coding agent для репозитория `kubzik96/genesis-ai`;
- GitHub API: create issue, read PR/diff/status;
- T-009 (операционная задача в Bridge).

---

## 7. Assumptions

- CEO имеет доступ к Dify Cloud и может открыть Web App с Android.
- В репозитории включён / доступен Copilot coding agent для Issues.
- Минимальных GitHub permissions достаточно для Issue + read PR.
- API-бюджет на spike ограничен и контролируем.
- Тестовая правка QUEUE encoding безопасна и не затрагивает другие задачи.

---

## 8. Критерии готовности (Acceptance Criteria)

Исходные требования One-Window **сохраняются**. `[x]` ставится только если критерий выполнен **как сформулирован** (автоматизация / One-Window path). Ручной обход **не** засчитывается как выполнение автоматического критерия.

- [ ] CEO открывает одно окно на Android и ПК.
- [ ] Контекст загружается из актуального `main`.
- [ ] Issue создаётся только после CEO confirmation (Gate 1).
- [ ] Copilot создаёт PR для тестовой задачи (только правка encoding в `bridge/QUEUE.md`).  
  *Stage 4 actual result: PARTIAL PASS — target diff was ultimately created/reviewed/merged (Issue #19 / PR #20 / `99e6d153…`), but Copilot runner / full One-Window automation did not satisfy this criterion.*
- [ ] Dify получает фактический PR и diff (не пересказ).  
  *Stage 4 actual result: PARTIAL PASS — Git artifacts existed; automated Dify observation path was not fully satisfied.*
- [ ] Reviewer анализирует Git-diff, а не пересказ агента.  
  *Stage 4 actual result: PARTIAL PASS — independent review and CEO Gate 3/4 occurred; not fully via the automated One-Window reviewer path.*
- [ ] CEO получает краткий verdict и ссылку на PR.
- [ ] Доступны действия Approve / Request changes / Reject (Gate 3).
- [ ] **Approve** означает кандидат `APPROVE_TO_MERGE` и **не** запускает merge.
- [ ] Request changes создаёт понятное продолжение workflow.
- [ ] Никакого auto-merge; merge не выполняется из workflow.  
  *Confirmed for Stage 4 encoding path: auto-merge not used; merge only after separate CEO Merge Authorization.*
- [ ] Секреты отсутствуют в GitHub и выводе workflow.
- [ ] Весь тестовый цикл воспроизводим.
- [ ] Критерий успеха достигнут **без** копирования команд между ChatGPT, Grok, Copilot и GitHub.  
  *Stage 4 actual result: PARTIAL PASS — full One-Window cycle without manual steps not achieved.*
- [ ] Preflight подтвердил наличие минимум одного API-провайдера (OpenAI **или** xAI); primary reviewer выбран.

**Stage 4 summary (evidence, not weakened DoD):** target encoding change is in `main`; Stage 4 = **PARTIAL PASS**; remaining unchecked criteria above remain **open requirements**.

---

## 9. Способы проверки

1. Запуск Web App с Android и ПК — UI доступен.
2. Preflight checklist (см. §14) — все критические зависимости зелёные либо BLOCKED с причиной.
3. Прогон тестового сценария QUEUE encoding end-to-end.
4. Сверка: Issue body ↔ S-0001; PR changed files = только `bridge/QUEUE.md`; diff содержит только целевую замену.
5. Reviewer output ссылается на конкретные строки diff.
6. Логи/экспорт конфигурации — поиск секретов (токены, ключи) даёт пустой результат.
7. Повторный прогон (Request changes → fix → review) без ручного копирования.
8. После Approve: merge **не** произошёл автоматически; требуется CEO Merge Authorization.
9. **Различать:** (a) фактический Git-результат PR #20 / commit `99e6d153…` — **подтверждён**; (b) критерий One-Window automation — **не достигнут** (PARTIAL PASS, не PASS).

---

## 10. Ожидаемые выходные артефакты

- Рабочий Dify Web App (URL) для CEO.
- Документация конфигурации workflow **без секретов** (экспорт / markdown в согласованном месте).
- Запись preflight (зависимости, бюджет, лимиты, выбранный primary reviewer).
- **Как минимум один успешный тестовый цикл:** Issue → PR → review → CEO decision (полный воспроизводимый One-Window path).
- Ссылки на Issue и PR тестового сценария.
- Краткий отчёт: что сработало, блокеры, рекомендация по долгосрочной платформе.

**Current evidence (not a weakened expected artifact):** Stage 4 produced a **PARTIAL PASS** (Issue #19 CLOSED; PR #20 MERGED squash `99e6d153…`; encoding fix in main). Full successful reproducible One-Window cycle remains **outstanding**.

---

## 11. Необходимость Decision Record

- [x] **Отдельный DR для временного spike не требуется.**
- [ ] После результатов spike **требуется отдельное решение** о долгосрочной Interaction / Execution Platform.
- [ ] DR-0006 (Codex role) — отдельный артефакт, **deferred**; не часть S-0001 scope и не блокирует One-Window critical path.
- [x] DR-0007 (Limited Grok Executor Path) — **Accepted** 2026-08-11; Execution Authorization остаётся NOT_GRANTED.

Возможные варианты будущего решения:

- остаться на Dify;
- LangGraph + Genesis Console;
- другой подтверждённый вариант.

Это решение оформляется **после** результатов S-0001, не внутри него.

---

## 12. Риски и открытые вопросы

| Риск | Митигация |
|---|---|
| Dify плохо стыкуется с Git-diff review | Review только по PR/diff из GitHub API |
| Copilot runner не завершает цикл автоматически | Зафиксировано как limitation; PARTIAL PASS; target diff всё же принят; критерий Copilot PR остаётся открытым |
| API-ключи / бюджет | Hard limits; достаточно одного провайдера; остановка при исчерпании |
| Секреты в логах | Запрет хранения в Git; проверка экспорта |
| Ложное ощущение «OS готова» / «Stage 4 = PASS» | Явный **PARTIAL PASS**; критерии One-Window не ослаблены; T-009 остаётся REVIEW |
| Vendor lock Dify | Option C: spike временный; решение о платформе после |
| Approve ошибочно трактуется как merge | Явное правило: Approve = `APPROVE_TO_MERGE` candidate only |
| Premature Approved на Revision 2 | Lifecycle completed: In Review → independent review → CEO Approval → Approved + INDEX same commit (S-0004 §3.1.1) |

Открытые вопросы:

1. Точный механизм устойчивого назначения Issue → Copilot без ручных шагов.
2. Primary reviewer (OpenAI **или** xAI) для воспроизводимого One-Window цикла.
3. Долгосрочная Interaction / Execution Platform — отдельное решение после spike.
4. Независимый API-reviewer для полностью автоматического One-Window цикла: OpenAI API сейчас недоступен; Grok не может review собственную реализацию как sole reviewer.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-07-24 | Grok — Chief Architect | Создан In Review; API = OpenAI **или** xAI; Approve = `APPROVE_TO_MERGE` candidate |
| 1 | 2026-07-24 | CEO Genesis AI | CEO Approval Revision 1 (HEAD `fa82e72c…`); **blanket Execution Authorization remains NOT_GRANTED** |
| 1 | 2026-07-25…26 | CEO Genesis AI (staged) | **Stage 1** DIFY_CONFIG_ONLY; **Stage 2** DIFY_READONLY_WIRING (+ Broker `context/read`); **Stage 3** ISSUE_CREATE_ONLY → GitHub Issue #15 via Broker after Gate 1; PARTIAL PASS (empty «Команда CEO» / «Контекст из GitHub»); idempotent replay OK |
| 1 | 2026-07-27 | Grok — Chief Architect | Metadata EA → **STAGED** (no blanket); history rows for Stages 1–3; **Stage 4 NOT_AUTHORIZED** (historical state); full body of Revision 1 preserved |
| 1 | 2026-07-27 | Grok — Chief Architect | §13 clarification: Stage 4 scope = assign Copilot / PR observation / independent live review; **Stage 4 ends at Gate 3**; merge of encoding PR requires **separate CEO Gate 4 / Merge Authorization** (outside Stage 4) |
| 2 | 2026-08-07 | Grok — under S-0004 PR A EA | Revision 2 prepared as In Review. Stage 4 **PARTIAL PASS** recorded as evidence. Original One-Window acceptance criteria **preserved** (not weakened). Related Specs: S-0004 authoritative, S-0003 Superseded. |
| 2 | 2026-08-07 | CEO Genesis AI | **Approved** Revision 2 after independent specification review (BLOCKERS NONE). INDEX synchronized in same commit. **No** new blanket Execution Authorization. |
| 3 | 2026-08-11 | ChatGPT — COO | Подготовлен Draft: исторический Copilot path сохранён; предложен отдельный S-0005 Grok/xAI path; полного One-Window PASS и нового EA нет. |
| 3 | 2026-08-11 | CEO Genesis AI | **Approved** Revision 3. Execution Authorization остаётся **NOT_GRANTED**. Реализация, deployment, secrets operations и smoke не разрешены этим Approval. |

### Stage 4 — текущий итог (Revision 2)

- **Result:** **PARTIAL PASS** (not PASS).
- **Historical:** Stage 4 was **NOT_AUTHORIZED** until separate CEO authorization.
- **Issue #19:** CLOSED / completed.
- **PR #20:** MERGED (squash).
- **Squash commit:** `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`.
- **Diff:** only encoding fix in `bridge/QUEUE.md`.
- **Auto-merge:** not used.
- **CI:** `CI_NOT_CONFIGURED`.
- **Limitation:** Copilot runner did not complete the full automatic implementation cycle; target diff accepted after independent review and separate CEO Gate 3 / Gate 4.
- **One-Window without manual steps:** not achieved.
- **T-009:** REVIEW (not DONE).
- **DoD:** original success criteria in §8 remain open where unchecked; PARTIAL PASS does not redefine them.

---

## 14. Preflight (до реализации)

Перед Execution Authorization и реализацией проверить:

- [ ] доступность Dify Cloud для выбранного workflow;
- [ ] наличие **минимум одного** API-ключа: OpenAI API **или** xAI API;
- [ ] (optional) второй API-провайдер, если нужен резерв;
- [ ] **primary reviewer** выбран на preflight;
- [ ] установленный месячный бюджет и hard limits;
- [ ] доступность Copilot coding agent для `kubzik96/genesis-ai`;
- [ ] возможность назначить / запустить Issue → Copilot через доступный GitHub API;
- [ ] минимальные GitHub permissions (Issue create + PR read);
- [ ] удобство Dify Web App на Android;
- [ ] отсутствие секретов в логах и Git-артефактах (процедура проверки).

При отсутствии **критической** зависимости (в т.ч. ни одного API-провайдера) реализация останавливается со статусом **BLOCKED** и явным перечнем причин.

---

## 15. Зафиксированные решения CEO (основание S-0001)

1. Dify Cloud — временный Interaction + Orchestration MVP.
2. GitHub — постоянный System of Record.
3. Copilot — Engineer через GitHub Issue → PR, не LLM внутри Dify.
4. Planner и независимый Reviewer — через **минимум один** из: OpenAI API **или** xAI API; второй optional; primary выбирается на preflight.
5. ChatGPT Plus и подписка Grok не считаются API-доступом.
6. GitHub write-scope MVP — Issue + действия для запуска Copilot.
7. Чтение PR, diff и статусов — через GitHub API.
8. Merge — ручной, требует отдельного CEO Merge Authorization.
9. Кнопка **Approve** = кандидат `APPROVE_TO_MERGE`; не является Merge Authorization и не запускает merge.
10. T-006 остаётся BLOCKED.
11. Собственная Genesis Console и LangGraph не входят в S-0001.
12. После MVP — отдельное решение о долгосрочной платформе.
13. Секреты запрещено хранить в GitHub.
14. Stage 4 result = **PARTIAL PASS** (evidence); T-009 не переводится в DONE без принятия воспроизводимого One-Window цикла; исходные критерии §8 не ослабляются (S-0004 SoR path).
