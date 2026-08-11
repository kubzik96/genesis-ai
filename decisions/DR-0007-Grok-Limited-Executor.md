# DR-0007 — Grok Limited Executor through Genesis Broker

## Идентификатор

DR-0007

## Название

Grok Limited Executor through Genesis Broker

## Статус

Предложено

## Дата

2026-08-11

## Автор предложения

ChatGPT — COO, по поручению CEO и итогам архитектурного review Grok

---

# Контекст

Genesis должен работать из одного окна и не требовать от CEO вручную переносить задания между ChatGPT, Grok и GitHub.

Copilot Cloud Agent path, заложенный в S-0001/S-0002, недоступен на текущем GitHub Copilot Free. У CEO уже оплачен xAI API. Текущий Broker не умеет вызывать Grok или создавать branch/commit/draft PR и не может быть расширен без отдельного решения.

DR-0005 уже разрешает Grok выполнять GitHub execution только по явному CEO Authorization и запрещает ему быть sole reviewer собственной реализации. Нужен отдельный архитектурный контракт, который применяет эти правила к автоматическому executor path.

---

# Цель

Разрешить проектирование ограниченного Grok/xAI executor path, который убирает ручное копирование задания в Grok, но сохраняет GitHub как System of Record, Broker как единственную write boundary и CEO как владельца всех решений.

---

# Рассмотренные варианты

## Вариант A — возобновить платный GitHub Copilot

Преимущества:

- сохраняется исходный Issue → Copilot → PR path;
- меньше изменений Broker.

Риски:

- постоянная подписка;
- зависимость от Copilot Cloud Agent;
- не использует уже оплаченный xAI API.

## Вариант B — Grok/xAI как limited executor через Broker

Преимущества:

- использует уже оплаченный xAI API;
- убирает ручное копирование задания в Grok;
- сохраняет server-side guardrails и GitHub SoR;
- не требует давать GitHub credentials модели.

Риски:

- новый высокорисковый Broker write-contract;
- Grok совмещает роли Architect/executor;
- нужен независимый не-Grok reviewer;
- необходимы строгие limits и recovery semantics.

## Вариант C — оставить ручную работу с Copilot Free/Grok

Преимущества:

- нет нового write endpoint;
- минимальная стоимость инфраструктуры.

Риски:

- не достигается цель одного окна;
- CEO продолжает переносить контекст вручную;
- процесс остаётся плохо воспроизводимым.

---

# Предлагаемое решение

Выбрать **вариант B** при следующих обязательных границах:

1. Grok/xAI является только task-scoped limited executor, а не автономным control plane.
2. Dify не пишет напрямую в GitHub.
3. `XAI_API_KEY` и GitHub credential находятся только в Broker secrets.
4. Grok не получает GitHub credentials.
5. Broker получает ровно один новый composite endpoint `create_branch_commit_draft_pr` по S-0005.
6. Endpoint работает только с `kubzik96/genesis-ai`, точным актуальным base SHA, новой веткой и draft PR.
7. Revision 1 S-0005 ограничена одним файлом `MEMORY.md`, 1–3 changed lines и 2 KiB diff.
8. Direct `main`, force-push, merge, auto-merge, delete и generic proxy отсутствуют.
9. Каждый live write требует task-scoped CEO Gate и idempotency.
10. Grok не может быть sole independent reviewer собственной реализации.
11. Первый smoke останавливается до independent review и не объявляется полным One-Window PASS.
12. Любое расширение scope требует новой Revision, review и CEO Approval.

Это решение не отменяет DR-0002 или DR-0005. Copilot сохраняет назначенную роль, когда соответствующая возможность доступна. DR-0007 добавляет альтернативный ограниченный executor path.

---

# Причины

- xAI API уже оплачен;
- вариант устраняет текущую ручную передачу задания в Grok;
- модель не получает прямой GitHub access;
- Broker может enforce ограничения независимо от ответа модели;
- draft PR и отдельный reviewer сохраняют управляемость.

---

# Последствия

## Положительные

- CEO работает ближе к одному окну;
- xAI используется программно и воспроизводимо;
- GitHub остаётся единственным источником истины;
- модель физически не может выполнить merge через предусмотренный контракт.

## Отрицательные

- Broker получает новые Contents/Pull requests write-возможности;
- потребуются новые tests, docs, deployment и recovery procedure;
- до подключения независимого API-reviewer полный One-Window цикл остаётся незавершённым.

## Риски

- partial writes при сбое между branch, commit и PR;
- попытка модели расширить scope;
- утечка секретов через logs или model input;
- ошибочное доверие self-review Grok;
- превращение Broker в слишком широкий GitHub proxy.

---

# Проверка результата

- S-0005 утверждена отдельно и имеет staged EA;
- новый endpoint имеет server-side allowlist, hard limits, idempotency и fail-closed recovery;
- negative tests доказывают запрет other repo/main/merge/binary/second file;
- первый live smoke создаёт только новую ветку, один commit и один draft PR для `MEMORY.md`;
- фактический diff проверяет независимый не-Grok reviewer;
- merge отсутствует и требует отдельного CEO Merge Authorization вне этого path.

---

# Связанные документы

- `governance/Constitution.md`
- `governance/Roles.md`
- `governance/DevelopmentWorkflow.md`
- `decisions/DR-0005-Operational-AI-Team-Roles.md`
- `specifications/S-0001-Genesis-One-Window-Execution-Spike.md`
- `specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md`
- `specifications/S-0005-Genesis-Limited-Grok-Executor-Path.md`

---

# История изменений

- 2026-08-11 — создано предложение; CEO Approval и Execution Authorization не выданы.
