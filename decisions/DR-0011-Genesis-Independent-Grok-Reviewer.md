# DR-0011 — Genesis Independent Grok Reviewer

## Идентификатор

DR-0011

## Название

Genesis Independent Grok Reviewer

## Статус

**Принято**

## Дата

2026-09-03

## Автор предложения

ChatGPT — COO, по поручению CEO Genesis AI

---

# Контекст

Genesis Orchestrator v0.1 уже использует независимый review как обязательное доказательство перед последующими CEO gates. Временный Qodo review подтвердил полезность GitHub-native независимой проверки, но Qodo используется как временная trial-зависимость и не должен становиться постоянной архитектурной опорой Genesis.

В репозитории уже существует S-0005 / DR-0007 для Grok/xAI как ограниченного executor через Genesis Broker. Этот путь является writer-capable и поэтому не может быть переиспользован как независимый reviewer contract без отдельной архитектурной границы. Кроме того, DR-0008 сохраняет Broker quarantine/default-off ограничения и запрещает считать новый reviewer разрешением на authenticated Broker use, secrets, deployment или LIVE xAI.

S-0008 определяет отдельный reviewer-only contract. Согласно Development Workflow новый системный компонент/capability требует Decision Record до реализации.

---

# Цель

Разрешить проектирование отдельного Genesis Independent Grok Reviewer: минимального read/advisory компонента, который проверяет bounded PR context, привязанный к exact HEAD, возвращает структурированный verdict и не получает GitHub write authority.

---

# Рассмотренные варианты

## Вариант A — оставить Qodo постоянным reviewer

Преимущества:

- уже доказан автоматический PR review;
- не требует новой Genesis runtime capability.

Риски:

- текущий доступ временный/trial;
- постоянная внешняя зависимость не контролируется Genesis;
- не решает задачу собственного независимого reviewer path.

## Вариант B — переиспользовать S-0005 Grok writer/executor как reviewer

Преимущества:

- часть xAI/Broker primitives уже существует;
- меньше нового кода.

Риски:

- смешивает reviewer и writer authority;
- повышает риск self-review;
- наследует write-capable contract, который reviewer не должен иметь;
- усложняет доказательство fail-closed security boundary.

## Вариант C — отдельный reviewer-only Grok/xAI contract

Преимущества:

- минимальная authority;
- точная exact-HEAD и stale-review semantics;
- Grok/xAI не получает GitHub credentials;
- writer и reviewer остаются архитектурно раздельными;
- Qodo можно убрать после доказанного replacement path.

Риски:

- появляется новый системный компонент/capability;
- нужны отдельные schema/validation/tests и orchestration glue;
- LIVE xAI и Broker transport остаются заблокированы отдельными security gates.

---

# Решение

Выбрать **вариант C** при следующих обязательных границах:

1. Reviewer является отдельным reviewer-only contract и не расширяет S-0005 writer endpoint или его authority.
2. GitHub остаётся durable Source of Record; Genesis orchestrator остаётся control-plane role.
3. Review привязан к repository, PR number и exact 40-character HEAD SHA.
4. Request-time HEAD, `REVIEWED_HEAD_SHA` и acceptance-time current HEAD должны совпадать; иначе результат fail-closed и не может служить gate evidence.
5. Reviewer получает только bounded secret-free diff/context, необходимый для проверки.
6. Grok/xAI не получает GitHub PAT, `BROKER_SERVICE_TOKEN`, repository write credentials или другой mutation capability.
7. Reviewer не создаёт и не изменяет Issues, comments, branches, commits, PRs или refs; не выполняет Ready/merge/deploy/secrets/LIVE.
8. Structured reviewer output валидируется, включая cross-field invariants; malformed или contradictory output нормализуется в `BLOCKED` / `READY_GATE_SAFE: NO`.
9. Grok/xAI не может быть sole independent reviewer артефакта, созданного Grok/xAI, включая S-0005 execution output.
10. Любой reviewer verdict, который влияет на Ready, merge, Specification Approval, Decision Record acceptance или другой consequential gate, MUST быть durably recorded in GitHub вместе с exact reviewed HEAD до использования как gate evidence. Persist выполняет trusted Genesis orchestrator/control boundary, а не Grok/xAI reviewer; это не расширяет zero-write authority reviewer.
11. Qodo остаётся допустимым временным независимым reviewer до доказанного replacement path, но не является dependency нового компонента.
12. DR-0008 quarantine/default-off остаётся полностью в силе. Этот DR не разрешает authenticated Broker calls, rotation, secrets operations, Dify unfreeze, deployment или LIVE xAI.
13. Если будущая реализация потребует нового control plane, нового credential trust boundary, Dify unfreeze или расширения Broker authority за пределы этого решения, работа останавливается до нового/пересмотренного архитектурного решения.

---

# Причины

- независимый reviewer нужен для уменьшения ручной работы CEO без ослабления gates;
- reviewer authority должна быть строго меньше executor authority;
- exact-HEAD binding предотвращает использование устаревшего review после изменения PR;
- отсутствие GitHub write credentials у модели уменьшает blast radius;
- durable GitHub evidence сохраняет воспроизводимость consequential gates без выдачи reviewer write authority;
- отдельный contract позволяет тестировать fail-closed semantics независимо от S-0005 writer path;
- решение сохраняет существующие Genesis governance boundaries вместо создания второго control plane.

---

# Последствия

## Положительные

- Genesis получает архитектурно определённый путь постоянного независимого review;
- writer и reviewer разделены;
- GitHub SoR и CEO gates сохраняются;
- verdict, влияющий на consequential gate, не может оставаться off-record;
- Qodo может быть заменён после доказанного reviewer path;
- model output остаётся advisory и проверяется до использования как gate evidence.

## Отрицательные

- потребуется отдельная bounded implementation и тесты;
- trusted Genesis side должен сохранять применимое reviewer evidence в GitHub;
- reviewer transport/API invocation добавит новую runtime capability после отдельной EA;
- до разрешения DR-0008 prerequisites LIVE reviewer не может быть доказан end-to-end.

## Риски

- stale review при изменении PR HEAD во время проверки;
- contradictory model verdict;
- accidental reuse write-capable S-0005 primitives;
- self-review Grok;
- утечка credential/sensitive context в model input;
- off-record gate evidence;
- ошибочное толкование reviewer approval как CEO authorization.

Все эти риски должны fail closed по S-0008 и локальным/mock tests до любого LIVE gate.

---

# Проверка результата

До implementation-ready состояния должны быть доказаны как минимум:

- отдельный reviewer contract без GitHub write operation;
- request-time и acceptance-time exact-HEAD verification;
- обязательный `REVIEWED_HEAD_SHA`;
- fail-closed при stale/mismatched HEAD;
- fail-closed при malformed/contradictory structured output;
- bounded secret-free payload;
- запрет Grok self-review как independent evidence;
- отсутствие GitHub credentials у Grok/xAI;
- consequential-gate reviewer evidence durably recorded in GitHub by trusted Genesis side with exact reviewed HEAD before gate use;
- сохранение DR-0008 quarantine/default-off;
- независимый exact-HEAD review реализации;
- отдельные CEO gates для EA, secrets/Broker/quarantine, deployment и первого LIVE xAI call.

---

# Связанные документы

- `governance/DevelopmentWorkflow.md`
- `governance/Roles.md`
- `decisions/DR-0005-Operational-AI-Team-Roles.md`
- `decisions/DR-0007-Grok-Limited-Executor.md`
- `decisions/DR-0008-Broker-Token-Exposure-Quarantine.md`
- `decisions/DR-0009-Private-Dify-Broker-Tool-Plugin.md`
- `specifications/S-0005-Genesis-Limited-Grok-Executor-Path.md`
- `specifications/S-0007-Genesis-Orchestrator-v0.1.md`
- `specifications/S-0008-Genesis-Independent-Grok-Reviewer-v0.1.md`
- Issue #79

---

# История изменений

- 2026-09-03 — создано предложение для устранения governance finding независимого Qodo review S-0008.
- 2026-09-03 — по independent Qodo finding добавлено обязательное durable GitHub recording reviewer evidence, влияющего на consequential gates; persistence остаётся обязанностью trusted Genesis side, reviewer zero-write boundary не изменена.
- 2026-09-03 — **CEO принял DR-0011** по exact independently reviewed HEAD `0cdf9b50287e1c1250cbcd2fdcb4c3ab25f0023d`. Acceptance не выдаёт Execution Authorization и не разрешает implementation, xAI calls, authenticated Broker use, Broker/Dify/Cloudflare, secrets, deployment или LIVE.
