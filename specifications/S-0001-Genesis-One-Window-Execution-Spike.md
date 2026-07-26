# S-0001 — Genesis One-Window Execution Spike

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0001 |
| **Название** | Genesis One-Window Execution Spike |
| **Статус** | Approved |
| **Revision** | 1 |
| **Автор** | Grok — Chief Architect |
| **Дата создания** | 2026-07-24 |
| **Дата утверждения** | 2026-07-24 |
| **Утвердил** | CEO Genesis AI |
| **Execution Authorization** | **STAGED** — no blanket grant; see §13 history. **Stage 4 NOT_AUTHORIZED** |
| **Связанные задачи** | T-009 — Genesis One-Window Execution Spike |
| **Связанные Decision Records** | DR-0004 |
| **Исполнитель (после Authorization)** | Integration Engineer / Lead Engineer (по stage) |

> Approval спецификации **не** означает разрешение на реализацию.  
> **Не было** единого общего Execution Authorization «на весь S-0001».  
> Каждый stage выполнялся только после **отдельного** CEO Authorization.  
> **Stage 4 (Copilot assign / further writes) сейчас NOT_AUTHORIZED.**

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

---

## 3. Scope

### В Scope (разрешено)

- Dify Cloud Web App для телефона и ПК;
- один управляемый workflow;
- чтение из GitHub (allowlisted paths);
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

12. Минимум один API-провайдер: **OpenAI API** **или** **xAI API**; primary выбирается на preflight.
13. Reviewer анализирует фактический diff.
14. После review — Gate 3.

### 4.6 CEO decision

15. Approve / Request changes / Reject.
16. **Approve** = кандидат `APPROVE_TO_MERGE`; **не** Merge Authorization; **не** запускает merge.
17. Merge — только отдельный CEO Merge Authorization (Gate 4 вне spike workflow).

### 4.7 Security & operations

19. Секреты только в защищённых настройках платформы.
20. Секреты отсутствуют в GitHub и экспорте.
21. Бюджет и hard limits API.

### 4.8 Обязательные CEO Gates

| Gate | Момент |
|---|---|
| 1 | Перед созданием GitHub Issue |
| 2 | Перед передачей задачи Copilot |
| 3 | После независимого review |
| 4 | Перед merge (вне S-0001 workflow) |

---

## 5. Ограничения

- ChatGPT Plus ≠ OpenAI API; подписка Grok ≠ xAI API.
- T-006 остаётся BLOCKED.
- Dify — временный MVP.
- Один тестовый сценарий на spike.
- CI может быть `CI_NOT_CONFIGURED`.

---

## 6. Dependencies

- DR-0004; Development Workflow; Bridge; Dify; API key (OpenAI или xAI); Copilot; Broker (S-0002) для controlled GitHub path; T-009.

---

## 7. Assumptions

- CEO имеет Dify; Copilot доступен на repo; API-бюджет ограничен; encoding-правка безопасна.

---

## 8. Критерии готовности (Acceptance Criteria)

- [ ] CEO открывает одно окно на Android и ПК.
- [ ] Контекст из актуального `main`.
- [ ] Issue только после Gate 1.
- [ ] Copilot PR только encoding в `bridge/QUEUE.md`.
- [ ] Фактический PR/diff в Dify.
- [ ] Reviewer по Git-diff.
- [ ] Gate 3: Approve / Request changes / Reject.
- [ ] Approve ≠ merge.
- [ ] Нет auto-merge; секреты не в Git.
- [ ] Цикл без копирования между чатами.

---

## 9–12. (Способы проверки, артефакты, DR, риски)

См. исходную Revision 1: Git-diff review, export без секретов, primary reviewer xAI (key deferred), T-006 BLOCKED, Approve ≠ merge.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-07-24 | Grok — Chief Architect | Создан In Review |
| 1 | 2026-07-24 | CEO Genesis AI | Approval; **blanket EA = NOT_GRANTED** |
| 1 | 2026-07-25…26 | CEO staged auths | **Stage 1** DIFY_CONFIG_ONLY; **Stage 2** DIFY_READONLY_WIRING + Broker context/read; **Stage 3** ISSUE_CREATE_ONLY → Issue #15, PARTIAL PASS (empty CEO/context sections) |
| 1 | 2026-07-27 | Grok — Chief Architect | Metadata EA → **STAGED**; explicit **Stage 4 NOT_AUTHORIZED**; no rewrite of prior history |

**Stage 4 (assign Copilot / PR observation / xAI / merge encoding)** — **NOT_AUTHORIZED** until separate CEO command.

---

## 14. Preflight

Перед **следующим** stage Authorization: Dify, Broker health, PAT scope for that stage only, primary reviewer key when needed, no secrets in Git.

---

## 15. Зафиксированные решения CEO (основание S-0001)

1. Dify Cloud — временный Interaction + Orchestration MVP.
2. GitHub — SoR.
3. Copilot — Engineer через Issue → PR.
4. Reviewer — OpenAI **или** xAI API (не подписка).
5. Merge — только CEO Merge Authorization.
6. Approve = `APPROVE_TO_MERGE` candidate only.
7. T-006 BLOCKED.
8. Секреты не в GitHub.
9. Execution — **только staged** CEO authorizations.
