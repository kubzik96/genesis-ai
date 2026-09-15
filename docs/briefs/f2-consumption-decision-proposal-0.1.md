# F2: идентичность разрешения, расход и переход со старых записей

Статус: **PROPOSAL / DESIGN REVIEW ONLY / NOT_ACCEPTED**.
Canonical Issue: [#116](https://github.com/kubzik96/genesis-ai/issues/116).
SESSION_ID: `ASTRA-AEM11-20260910T093120Z`.
Exact baseline: `5b5914279d7647279f42050681c9593af1b51761`.
Memory impact: NO — предложение и эксперименты не меняют принятую recovery truth.

Этот документ подготовлен в рамках CEO Autonomous Engineering Mandate v1.1.
Он не меняет действующие DR/Specifications, не принимает архитектуру и не
разрешает F2 implementation PR, Ready, merge или production. Следующее решение
CEO должно отдельно принять design; implementation требует следующей отдельной
EA и approved functional requirements с точным file allowlist.

## 1. Решение, которое требуется от CEO

Рекомендуется один неизменяемый идентификатор на выданное CEO разрешение,
восстанавливаемый из GitHub, плюс hash его неизменяемых условий. Новый запуск
не создаёт нового разрешения. После принятой runtime попытки разрешение
закрывается и при ошибке; неопределённый результат не позволяет повтор модели.
Старым разрешениям нельзя автоматически присвоить новые IDs и считать их
неиспользованными. Это рекомендуемый вариант, а не единственно возможное решение.

До принятия этого предложения F2 остаётся **OPEN / NOT_FIXED**.

## 2. Что подтверждено непосредственно

F1 уже исправлен в main через [#114](https://github.com/kubzik96/genesis-ai/pull/114);
[#115](https://github.com/kubzik96/genesis-ai/pull/115) синхронизировал MEMORY.
[#116](https://github.com/kubzik96/genesis-ai/issues/116) содержит Julius report,
но новый [tests-only PR #117](https://github.com/kubzik96/genesis-ai/pull/117)
даёт independently checked исполняемый Git-артефакт:

- один и тот же authorization, новые run_id и idempotency key: model dispatch=2;
- смена только одного идентификатора: второй dispatch блокируется;
- concurrent requests к одному DO и последовательная реконструкция повторяют F2;
- после GitHub evidence и failed final storage write старый запрос остаётся
  PENDING; новые run/key обходят эту защиту;
- UNKNOWN после failed evidence read-back блокирует старые идентификаторы,
  но не новое имя запуска с тем же authorization;
- два таких запуска могут записать byte-identical V1 evidence comments.

Тип evidence: **local/mock**, реальный public Worker handler, canonical request
hash, DO proxy и production adapter с fake fetch; Map имитирует atomic storage.
Cloudflare SQLite, process kill и production xAI здесь не проверялись.

Baseline suite: 233/233. Tests-only targeted: 9/9. Full suite с characterization:
242/242, 26 suites, Node v24.19.0, exit 0. Зелёные KNOWN DEFECT tests подтверждают
дефект; это не regression PASS исправления. После исправления их два-dispatch
ожидания необходимо заменить нормативным at-most-one invariant.

[Полный tests-only Result Package](https://github.com/kubzik96/genesis-ai/issues/116#issuecomment-5616506325)
содержит exact bytes, hashes, diff и команды. Production source в #117 не меняется.

## 3. Обязательные существующие границы

[S-0010](https://github.com/kubzik96/genesis-ai/blob/5b5914279d7647279f42050681c9593af1b51761/specifications/S-0010-Genesis-Independent-Reviewer-Orchestration-v0.1.md)
требует не более одного reviewer request на authorization, retries=0 и новой
применимой authorization после failure или смены HEAD.
[S-0009](https://github.com/kubzik96/genesis-ai/blob/5b5914279d7647279f42050681c9593af1b51761/specifications/S-0009-Genesis-Independent-Grok-Reviewer-v0.2.md)
и [DR-0011](https://github.com/kubzik96/genesis-ai/blob/5b5914279d7647279f42050681c9593af1b51761/decisions/DR-0011-Genesis-Independent-Grok-Reviewer.md)
сохраняют exact-HEAD, reviewer zero-write authority и trusted Genesis persistence.
DR-0008 остаётся ACTIVE. F1 freshness, default-OFF, writer/reviewer separation,
run_id и idempotency identities не переопределяются как grant identities.

## 4. Сравнение вариантов

| Вариант | Преимущество | Неустранённый риск | Вывод |
|---|---|---|---|
| Explicit immutable grant_id | Отделяет выданное разрешение от run/key; различает два легитимных одинаковых grants | Требуется неизменяемая выдача и восстановление ID, а не новая строка на каждый запуск | Подходит при полном issuer contract |
| Canonical authorization hash | Малое изменение; дедупликация одинаковых объектов без нового поля | Не различает новые одинаковые CEO grants; изменение текста может изменить hash без нового права | Использовать как binding, не как единственную identity |
| Nonce / EA identity | Работает, если nonce создан один раз при выдаче и сохранён | Nonce per request/run повторяет F2; сама случайная строка не доказывает выдачу | Эквивалент stable ID при правильной выдаче |
| GitHub EA reference + immutable manifest hash | Новый controller восстанавливает то же разрешение из canonical evidence | Комментарии редактируемы; нужны pinned digest, issuer rules и явный новый EA для изменения | Рекомендуемая форма explicit ID |
| Подписанный grant token | Runtime может отдельно проверять issuer | Новые keys/lifecycle/rotation; consumption ledger всё равно нужен | Сейчас необходимость не доказана |

## 5. Предлагаемый issuer contract

1. Только существующая trusted Genesis control boundary материализует реально
   выданную CEO EA в GitHub. Ни модель, ни executor, ни retry/recovery код не
   создают новое право из факта запуска. Review approval не является EA.
2. Одна выдача имеет один canonical GitHub locator и manifest. Например,
   `gh:kubzik96/genesis-ai:issue-comment:<id>` обозначает запись выдачи,
   а не run/session/comment reviewer result. Числовой ID в примере не назначен.
3. Предлагаемый runtime field — `grantId` внутри authorization, одинаковый во
   всех обращениях по этой выдаче. Это будущая closed-schema смена, сейчас она
   не реализована и не разрешена. Сырой Idempotency-Key не используется как ID.
4. Manifest фиксирует repository, PR, lowercase exact HEAD, purpose, ordered
   criteria, producer identity, model/persistence permissions и forbidden actions.
   Hash — SHA-256 явно канонизированного manifest: sorted object keys,
   forbiddenActions как отсортированный set, criteria как ordered array,
   UTF-8; никакой семантической нормализации произвольного текста.
5. Canonical EA receipt также pin-ит digest исходной записи выдачи. Редактирование
   этой записи не создаёт новый grant: несовпавший digest блокирует использование.
   Изменившиеся условия требуют новой явно выданной CEO EA и нового locator.
6. При recovery Genesis read-only получает ту же запись/manifest, проверяет
   provenance и digest и восстанавливает прежний ID. Отсутствие записи,
   неоднозначный issuer, конфликт digest или неизвестный расход — fail closed.
7. Broker продолжает доверять аутентифицированной Genesis boundary как issuer;
   grantId не секрет и не новая credential. DO проверяет immutable binding и
   расход ID. Это не защита от произвольно злонамеренного владельца действующего
   service credential; новый credential trust boundary не вводится.
8. Проверка факта CEO EA и durable mapping обязательна в trusted issuer path,
   до dispatch. Простое принятие любой новой строки ID вместо этой проверки
   не удовлетворяет design. Новый легитимный grant с идентичным payload допустим
   только при отдельном canonical CEO EA, а не после переименования старого.

## 6. Предлагаемый consumption lifecycle

Это расход **принятой попытки**, а не только успешного model result. Такая
консервативная политика не вводит исключение из no-retry после failure S-0010.

| Событие | Durable grant state | Возможен новый dispatch по этому grant? |
|---|---|---|
| Неверная/отсутствующая EA до admission | Не создаётся доступное право | Нет |
| Валидная EA; атомарный reserve grant + idem + run до model | RESERVED | Нет второго dispatch |
| Model вызван; валидный положительный или отрицательный review | CONSUMED | Нет |
| Принятая попытка завершилась до model с ошибкой | CLOSED_NO_CALL | Нет; нужна новая применимая EA |
| Provider failure, malformed result или timeout после dispatch | CONSUMED либо UNKNOWN при потере знания | Нет |
| Evidence write/read-back не определён | UNKNOWN | Нет |
| Crash после reserve или remote effect до final state | RESERVED/UNKNOWN | Нет; только read-only reconciliation |
| Тот же завершённый запрос, same key/hash | Existing immutable replay + F1 HEAD verification | Replay без новой модели/записи |

Не добавлять RELEASED-to-retry, TTL unlock, auto-clear PENDING/UNKNOWN или
автоматическое расходование нового grant. Атомарность reserve должна быть
проверена на целевом DO storage contract; два fake DO с общей Map не заменяют
реальную concurrency модель Cloudflare.

Первый локальный implementation prototype с `authorizationId` и grant ledger
доказал блокирование повторов stable ID, но независимо найдено пять gaps:
legacy consumption bypass, произвольное переименование без issuer mapping,
RELEASED после явной ошибки, broken legacy replay и потеря связи с comment.
**Этот prototype не принимается как готовое исправление.**
Adversarial probes: 11/11 наблюдений воспроизведены; это verification findings,
а не clean acceptance production candidate.

## 7. Legacy / cutover contract

- Не выдавать grants задним числом и не считать новое поле новым CEO разрешением.
- Перед будущей активацией новой версии нужен read-only inventory старых
  SUCCEEDED/FAILED/PENDING/UNKNOWN и canonical EA evidence. Невосстановимая
  связь не заполняется догадкой; legacy uncertain runs остаются заблокированными.
- Старый request без grantId не допускается к новому execution. Default-OFF
  сохраняется до отдельной проверки operational cutover prerequisites.
- При наличии старого точного same-key/request-hash SUCCEEDED допускается только
  существующий immutable replay с F1 fresh HEAD check. FAILED replay сохраняет
  свою blocked semantics. PENDING/UNKNOWN/CONFLICT не повышаются до success.
  Это требует явного legacy read-only validation path; нельзя просто сделать
  поле mandatory перед idempotency lookup и заявить полную совместимость.
- Если старого exact record нет, ошибка чтения или неизвестный hash — blocked,
  без модели и без создания evidence. Legacy request никогда не падает обратно
  в fresh execution path.
- Любой дальнейший model request после закрытой/неопределённой старой попытки
  требует действительно новой применимой CEO EA; migration не выдаёт её.
- Production deployment, inventory acquisition boundary и переход состояния
  не входят в текущий design review или tests-only PR.

## 8. Граница crash reconciliation

Current V1 comment содержит PR/HEAD/verdict, но не run/grant/request identity.
DO PENDING имеет run/hash, но не exact expected evidence/receipt. Comment ID
остаётся в runtime closure; даже один найденный V1 comment не доказывает связь
с конкретной зависшей операцией. Нулевое число comments не доказывает ноль calls.

Локальный read-only classifier проверен 15 deterministic tests: он различает
отсутствующие, stale, single-unbound, duplicate и malformed snapshots; всегда
сохраняет BLOCKED/READY_GATE_SAFE=NO и не делает model calls/state writes.
Это наблюдение и safe stop; автоматическая completion не реализована.

Следующий отдельный recovery design должен определить durable operation intent,
grant/binding association, expected normalized evidence hash ДО GitHub write,
versioned evidence envelope, exact receipt/read-back и read-only status surface.
State finalization потребует отдельно разрешённого CAS; новый model request
или повтор evidence write не является reconciliation. Legacy unknown нельзя
исправить одной новой схемой без утраченной связи.

GitHub остаётся canonical project SoT. DO — execution ledger, а не независимый
источник архитектуры/полномочий. Genesis connector Publication Bridge проходит
вне Broker DO; ledger Broker не доказывает стадию чужой connector mutation.

## 9. Acceptance для будущего F2 implementation

Будущий bounded implementation contract обязан проверять:

1. Same issued EA / новые run/key / reconstruction / concurrent requests:
   не более одного model call и одной evidence persistence.
2. Новый ID без нового canonical EA не создаёт право; recovery issuer использует
   прежний ID; изменённый manifest/digest и неизвестный issuer блокируются.
3. Два явно разных новых grants с одинаковыми условиями различимы.
4. Reserve failure: 0 calls; reserve durable до первого возможного dispatch.
5. Negative review, provider failure и accepted pre-model failure закрывают
   grant; UNKNOWN/PENDING после crash не разрешают повтор.
6. Legacy success/failed replay, F1 same/stale/unreadable HEAD и конфликт hash
   сохраняют указанный read-only контракт; новые legacy executions запрещены.
7. Legacy consumed/unknown не переносятся как fresh grant при cutover.
8. Existing authorization boundaries, default-OFF, writer separation и model
   limits остаются; targeted/reviewer/full Broker suites зелёные.
9. Independent review actual exact HEAD; никаких production calls/deploy/LIVE
   или принятия reviewer approval за EA.

Минимальный file allowlist нельзя честно замкнуть на прежние два F1 файла:
меняются authorization schema/issuer contract и legacy validation path.
До implementation EA необходимо отдельно закрепить approved requirements,
точные runtime/issuer/test paths и исключения. Расширять scope по ходу нельзя.

## 10. DR-0008 и D2 readiness — не выполнять

DR-0008 остаётся ACTIVE. DR-0009 содержит историческую rotation, но не current
authentication readiness или quarantine lift. Authenticated production Broker
request, даже read-only, требует нового CEO gate. Секреты не читались/не менялись.

В этой среде нет доступного Cloudflare API: **D1_NOT_VERIFIED_VIA_CF_API**.
Current deployed version, traffic, installed secret presence и фактический LIVE
не подтверждены. Repository config содержит executor OFF; reviewer flag не
задан и код допускает execution только при literal `true`, то есть default-OFF.
Это доказательство кода, не production state. В коде нет автоматического OFF
alarm/expiry; `finally` клиента только очищает request timeout.

Исторический [PR #95 comment #5554958517](https://github.com/kubzik96/genesis-ai/pull/95#issuecomment-5554958517)
действительно содержит положительный V1 review от `2026-09-05T21:38:45Z` для
HEAD `6b307de36034c62c9d58eff39a3446b9e103e199`. Он совместим с поздним proof #96,
но не доказывает run/Worker/model-count/OFF chain. «Evidence никогда не было»
было бы неверно; permanent/current production orchestration не закрыта.

Будущий D2 candidate: open Draft #112, HEAD
`96b716232ca28f81dc1fbfee95e37fe472e93d40`, docs-only. Перед отдельным D2 gate
снова получить open Draft inventory и exact HEAD; не переносить старый gate.
Нужны current Worker version/tag/bindings/OFF, безопасный client, DR-0008
prerequisites, F2 constraints и crash-surviving automatic OFF mechanism.
До их фактической проверки статус **D2_NOT_EXECUTION_READY**.

D2 contract остаётся one authenticated POST `/v1/reviews/grok`, max model calls=1,
retries=0, exact-HEAD checks, trusted GitHub persistence/read-back и гарантированный
автоматический OFF. При timeout/UNKNOWN — только read-only reconciliation,
никакого второго POST под новым run/key. Никакие команды здесь не выполнялись.

## 11. Следующий отдельный CEO gate — предложение

Только design decision и его bounded canonical оформление; не implementation:

> На baseline `5b5914279d7647279f42050681c9593af1b51761` после read-only проверки
> exact reviewed HEAD этого Draft PR принимаю рекомендованные identity,
> issuer, lifecycle и legacy правила разделов 5–7 как основу F2 contract.
> Разрешаю один docs-only workstream для оформления этого решения в новой
> Draft Specification/Decision Record и независимого review, с последующим
> отдельным CEO approval перед любым promotion to Approved/Accepted.
> Exact allowlist: `specifications/S-0011-Reviewer-Grant-Consumption.md`,
> `specifications/INDEX.md`, `decisions/DR-0012-Reviewer-Grant-Consumption.md`,
> `decisions/INDEX.md`. При занятых IDs или изменившемся baseline — STOP.
> Не разрешаю F2 implementation PR, crash-reconciliation production implementation,
> Ready, merge, production Broker/Grok, secrets, LIVE, deploy, Dify, quarantine
> lift или продолжение по chained EA. Existing approved documents не переписывать.

Этот текст сейчас **NOT_GRANTED**. Он не принимает текущий implementation
prototype. Draft formalization не считается Approved/Accepted автоматически.

Дальнейший critical path после отдельных gates:
F2 accepted design и remediation → crash/evidence reconciliation → DR-0008
operational prerequisites → D2 one-shot production proof → One-Window Trial.
Не создавать дополнительные PR или model calls ради исчерпания session ceiling.
