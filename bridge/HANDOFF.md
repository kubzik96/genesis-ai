# Bridge: Context Handoff

## Назначение

HANDOFF.md описывает стандартный формат передачи контекста от одного агента другому.

Перед переводом задачи в статус READY создаётся запись HANDOFF с полной информацией о том, что нужно сделать.

---

## Структура HANDOFF

### Заголовок

```
## HANDOFF: T-XXX — Название задачи

Статус: READY
Исполнитель: [роль или имя агента]
Создано: YYYY-MM-DD
```

### Контекст

```
### Контекст

**Что было сделано до этого:**
- [факт 1]
- [факт 2]

**Зачем это нужно:**
[описание цели]

**Связь с другими задачами:**
- T-XXX [связь]
```

### Задача

```
### Задача

**Что нужно сделать:**
[чёткое описание работы]

**Ограничения:**
- [ограничение 1]
- [ограничение 2]

**Что менять нельзя:**
- [файл или процесс 1]
```

### Критерии готовности

```
### Критерии готовности

Задача считается завершённой, если:
- [ ] [критерий 1]
- [ ] [критерий 2]

Проверка:
- [ ] [способ проверки 1]
- [ ] [способ проверки 2]
```

### Входные данные

```
### Входные данные

**Файлы для справки:**
- MEMORY.md
- governance/Constitution.md
- governance/Roles.md

**Документы, которые нужно изменить:**
- [путь/файл.md]
```

### Выходные данные

```
### Выходные данные

**Что должно быть создано или изменено:**
- [путь/результат.md]

**Формат результата:**
[описание структуры]
```

---

## Активные HANDOFF

## HANDOFF: T-011 — Genesis Limited Grok Executor

Статус: REVIEW
Исполнитель: Grok / Integration Engineer  
Создано: 2026-08-11  
CEO Execution Authorization: **GRANTED — Stage 1 CODE_AND_TESTS_ONLY** (2026-08-11)

### Контекст

**Что было сделано до этого:**
- S-0005 Revision 1 Approved (2026-08-11, PR #27)
- DR-0007 Accepted (2026-08-11, PR #27)
- S-0001 Revision 3 Approved (документационная граница продолжения через S-0005)
- Copilot Cloud Agent path недоступен на Free plan → выбран limited Grok/xAI executor через Broker
- До Stage 1 Genesis Broker поддерживал Issue create, Assign Copilot, context/read, PR/diff read и не имел route для branch/commit/draft-PR
- Stage 1 реализован в PR [#29](https://github.com/kubzik96/genesis-ai/pull/29), независимо проверен и отдельно разрешён CEO к Ready, Approve и squash merge
- Проверенный HEAD PR #29: `348729a9cebe98476d00bc62c963aa4c0163efe4`; squash commit в `main`: `4c7677fcb0a84557888171c5c54cad8974e1e6be`

**Зачем это нужно:**
Убрать ручное копирование задания между окнами; реализовать один fail-closed composite endpoint, который позволит Grok формировать ограниченное изменение, а Broker — создавать отдельную ветку, один commit и draft PR под жёсткими server-side limits.

**Связь с другими задачами:**
- T-009 остаётся REVIEW (PARTIAL PASS); не DONE
- T-010 остаётся REVIEW; не DONE
- T-006 принят CEO как DONE после S-0007 Revision 1 / Trial #4; это не расширяет T-011 EA и не авторизует Stage 2/runtime
- S-0002 Revision 1 — foundations auth/idempotency/audit; allowlist не расширяется молча

### Задача (Stage 1 only)

**Что нужно сделать:**
Реализовать и покрыть тестами **один** composite endpoint:

```text
POST /v1/executions/grok/draft-pr
operation = create_branch_commit_draft_pr
```

в соответствии с Approved S-0005 Revision 1 (hard limits, schema, base SHA checks, idempotency, partial-failure → UNKNOWN).

**Разрешённые пути для Stage 1:**
- `services/genesis-broker/`
- `services/genesis-broker/tests/`
- `docs/genesis-broker/`

**Ограничения Stage 1 EA (CODE_AND_TESTS_ONLY):**
- только source + local unit/contract/negative/mock tests + docs;
- только mocked xAI и mocked GitHub integrations (runtime);
- feature branch + implementation commits + **draft PR** разрешены авторизованному GitHub-исполнителю (чат Grok) как артефакты разработки;
- результат Stage 1 — отдельный **draft PR**, ожидающий независимого (non-Grok) review;
- **запрещены runtime live GitHub writes:** новый Broker endpoint, xAI-модель и Dify **не** выполняют live GitHub writes на Stage 1;
- **запрещены:** direct `main`, merge, auto-merge, deployment, Cloudflare changes, secrets operations, live xAI calls, live smoke;
- hard limits Revision 1 S-0005 **не** ослаблять.

**Что менять нельзя:**
- `governance/Constitution.md`
- действующие Decision Records без отдельного DR
- S-0002 allowlist без новой Revision
- runtime Broker deployment / secrets
- `main` напрямую

### Критерии готовности Stage 1

Задача Stage 1 считается готовой к независимому review, если:
- [x] Один endpoint реализован без generic proxy/merge route
- [x] Server-side enforce: repo, base SHA, branch prefix, max 1 file, MEMORY.md smoke scope, ≤3 lines, ≤2 KiB, UTF-8 only, draft PR only
- [x] Unit/contract/negative/mock tests зелёные
- [x] Partial failure → UNKNOWN, no auto-retry
- [x] Docs обновлены в `docs/genesis-broker/`
- [x] Отдельный draft PR открыт на feature branch
- [x] Grok не sole reviewer собственной реализации

Проверка:
- [x] Independent non-Grok review фактического diff draft PR — PASS на HEAD `348729a9cebe98476d00bc62c963aa4c0163efe4`
- [ ] Отдельный CEO Gate перед любым следующим stage — Stage 2 и runtime пока не авторизованы

### Входные данные

**Файлы для справки:**
- `specifications/S-0005-Genesis-Limited-Grok-Executor-Path.md` (Approved R1)
- `decisions/DR-0007-Grok-Limited-Executor.md` (Accepted)
- `specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md` (Approved R1)
- `services/genesis-broker/` (существующий код)
- `MEMORY.md`, `bridge/QUEUE.md`

### Выходные данные Stage 1

**Что должно быть создано или изменено:**
- source/tests/docs для `POST /v1/executions/grok/draft-pr`
- feature branch + implementation commits + **draft PR** (не merge) как артефакты разработки

**Формат результата:**
Stage 1 завершил предусмотренный путь draft PR и independent review. PR #29 затем был переведён в Ready, APPROVED и объединён squash только по отдельным решениям CEO. T-011 остаётся **REVIEW**, не DONE. Runtime live path, deployment, secrets, Dify и smoke не выполнялись и не авторизованы.

---

## Пример HANDOFF

```
## HANDOFF: T-002 — Создать критерии оценки CTO

Статус: READY
Исполнитель: ChatGPT (CTO)
Создано: 2026-07-22

### Контекст

**Что было сделано до этого:**
- Создана система Decision Records
- Создана инфраструктура Bridge

**Зачем это нужно:**
Genesis AI нуждается в критериях для выбора постоянного CTO.

**Связь с другими задачами:**
- T-003 зависит от T-002
- T-004 зависит от T-003

### Задача

**Что нужно сделать:**
Создать документ с критериями оценки ИИ-моделей для роли CTO.

**Ограничения:**
- Критерии должны быть объективными
- Должны быть измеримы

**Что менять нельзя:**
- governance/Constitution.md
- governance/Roles.md

### Критерии готовности

Задача считается завершённой, если:
- [ ] Документ содержит 5-10 критериев
- [ ] Каждый критерий имеет способ измерения
- [ ] Критерии согласованы с Конституцией

Проверка:
- [ ] CEO прочитал и утвердил
- [ ] Результат сохранён в GitHub

### Входные данные

**Файлы для справки:**
- governance/Constitution.md
- governance/Roles.md
- MEMORY.md

### Выходные данные

**Что должно быть создано:**
- governance/CTO-Criteria.md

**Формат результата:**
Структурированный список критериев с описанием
```

---

## Правила создания HANDOFF

1. HANDOFF создаётся ДО начала работы, когда задача переходит в READY;
2. Исполнитель может задать вопросы перед началом работы;
3. При завершении задачи результат помещается в REVIEW;
4. HANDOFF остаётся в истории как справка для следующих сессий.
