# DR-0008 — Broker Token Exposure Quarantine

## Идентификатор

DR-0008

## Название

Broker Token Exposure Quarantine

## Статус

**Принято**

## Дата

2026-08-22

## Автор предложения

ChatGPT — COO, по решению CEO Genesis AI и итогам независимого risk review Grok

---

# Контекст

Для Worker `genesis-broker` был выполнен один изолированный fail-closed preflight из черновика Dify при `GROK_EXECUTOR_LIVE_ENABLED=false`.

Preflight вернул `EXECUTOR_DISABLED`, xAI tokens = 0; полный workflow не запускался и черновик не публиковался. После запуска интерфейс Dify отобразил заголовок `Authorization` в execution details без маскирования.

Значение credential не фиксируется в GitHub, чатах, Issue, PR или настоящем DR. Не доказано, что credential вышел за пределы авторизованных систем, но `BROKER_SERVICE_TOKEN` должен считаться потенциально раскрытым до ротации.

Нет evidence раскрытия `XAI_API_KEY` или `GITHUB_PAT`.

`GROK_EXECUTOR_LIVE_ENABLED=false` блокирует production Grok adapter, но не является общим выключателем Broker: тот же service token аутентифицирует остальные allowlisted read/write endpoints.

---

# Рассмотренные варианты

## Вариант A — немедленная ротация

Преимущества:

- минимальный срок действия потенциально раскрытого credential;
- быстрое восстановление trust boundary.

Риски и издержки:

- требует немедленной синхронной secret operation в Cloudflare и Dify;
- создаёт операционный риск при поспешной несогласованной замене;
- требует отдельного CEO authorization.

## Вариант B — операционный карантин и ротация перед следующим authenticated use

Преимущества:

- немедленно прекращает использование потенциально раскрытого credential;
- позволяет продолжить offline/read-only работу;
- делает ротацию обязательным gate до следующего authenticated Broker call;
- не предполагает компрометацию незатронутых secrets.

Риски:

- старый credential остаётся технически действующим до ротации;
- безопасность зависит от строгого соблюдения запрета authenticated Broker calls и ограничения доступа к Dify evidence.

## Вариант C — ротация только на финальном этапе проекта

Преимущества:

- минимальные текущие операционные затраты.

Риски:

- потенциально раскрытый credential остаётся частью обычного рабочего цикла;
- возможны authenticated read/write operations вне защиты Grok LIVE flag;
- неприемлемый остаточный риск для service boundary.

---

# Решение

Принят **вариант B** со следующими обязательными правилами:

1. `BROKER_SERVICE_TOKEN` имеет статус `TREAT_AS_COMPROMISED` до завершённой ротации.
2. До ротации запрещены любые authenticated HTTP calls к `genesis-broker`, включая read и write.
3. До ротации запрещены Dify node-runs, полный workflow и публикация draft, если они используют Broker authentication.
4. `GROK_EXECUTOR_LIVE_ENABLED` остаётся `false`; activation и live xAI/GitHub calls запрещены.
5. Разрешены только локальные tests без live Worker, документация, архитектура и read-only GitHub review.
6. Ротация `BROKER_SERVICE_TOKEN` является отдельным CEO Gate и должна завершиться до первого следующего authenticated Broker call.
7. Ротация должна синхронно обновить только Worker Secret и соответствующую Dify secret variable; значения не передаются через чат, Git, Issue, PR или logs.
8. `XAI_API_KEY` и `GITHUB_PAT` не считаются скомпрометированными без отдельного evidence.
9. Плановый срок действия GitHub PAT до 2026-09-07 рассматривается отдельным calendar gate, а не частью данного incident.
10. Dify run history не удаляется до решения об evidence retention. Secret values запрещено копировать из неё во внешние каналы.
11. Карантин снимается только отдельным решением CEO после ротации, controlled verification и проверки remediation логирования.

Настоящий DR не разрешает secret operations, Cloudflare deployment, изменение Dify, Broker calls, activation, live calls, Ready или merge.

---

# Причины

- Constitution §3 требует возражения и более безопасной альтернативы при очевидном риске.
- Service token расположен перед всеми Broker routes, кроме public health endpoint.
- Grok LIVE flag защищает только executor path и не уменьшает blast radius других authenticated endpoints.
- UI/log exposure является достаточным основанием для quarantine, даже если внешняя утечка не доказана.
- Ротация только затронутого credential соблюдает принцип минимальных изменений.

---

# Последствия

## Положительные

- потенциально раскрытый credential исключён из дальнейшего рабочего использования;
- offline/read-only развитие проекта может продолжаться;
- установлен проверяемый rotation gate;
- incident не расширяется на secrets без evidence.

## Отрицательные

- интеграционные проверки Broker и Dify заблокированы до ротации;
- требуется отдельная согласованная операция Worker + Dify;
- старый credential остаётся технически действующим в период карантина.

## Остаточный риск

До ротации сохраняется риск злоупотребления уже известным credential. Компенсирующая мера — полный запрет его использования проектом, ограничение доступа к evidence и запрет любых новых execution logs с этим credential.

---

# Проверка результата

До снятия карантина должно быть подтверждено:

- новый `BROKER_SERVICE_TOKEN` установлен только как Worker Secret и Dify secret variable;
- старый credential больше не проходит authentication;
- Dify не отображает новый credential в execution details либо запуск остаётся запрещённым;
- exact deployed Worker version и bindings проверены read-only;
- один controlled authenticated check отдельно разрешён CEO;
- `GROK_EXECUTOR_LIVE_ENABLED=false` сохраняется;
- CEO отдельно снял quarantine.

---

# Связанные документы

- `governance/Constitution.md`
- `governance/DevelopmentWorkflow.md`
- `decisions/DR-0007-Grok-Limited-Executor.md`
- `specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md`
- `specifications/S-0005-Genesis-Limited-Grok-Executor-Path.md`
- `docs/genesis-broker/secrets.md`
- `docs/genesis-broker/rotation.md`

---

# История изменений

- 2026-08-22 — CEO утвердил Quarantine Option B: rotate-before-next-authenticated-use; GitHub documentation PR разрешён отдельно без Ready/merge и без operational actions.
