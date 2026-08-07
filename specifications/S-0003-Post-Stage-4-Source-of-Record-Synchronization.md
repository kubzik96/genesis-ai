# S-0003 — Post-Stage-4 Source of Record Synchronization and Codex Role Definition

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0003 |
| **Название** | Post-Stage-4 Source of Record Synchronization and Codex Role Definition |
| **Статус** | **In Review** |
| **Revision** | **2** |
| **Автор Draft / Revision 1** | Codex — по ограниченному разрешению CEO |
| **Автор Revision 2** | Grok — Chief Architect (governance correction) |
| **Дата создания** | 2026-08-07 |
| **Дата утверждения Revision 1** | 2026-08-07 |
| **Утвердил Revision 1** | CEO Genesis AI |
| **Дата Revision 2** | 2026-08-07 |
| **Утвердил Revision 2** | *pending CEO Approval* |
| **Execution Authorization Revision 1** | **TERMINATED** (governance conflict: INDEX scope vs DR-0004; premature S-0001 Rev 2 Approved status) |
| **Execution Authorization Revision 2** | **NOT_GRANTED** (возможен только после CEO Approval Revision 2) |
| **Связанные задачи** | T-009, T-010 |
| **Связанные Decision Records** | DR-0004, DR-0005; DR-0006 — требуется при реализации роли Codex |

> **Revision 1** (2026-08-07) — **Approved** CEO; история сохранена.  
> **Revision 2** — **In Review** (candidate). Не Approved. Не даёт Execution Authorization.  
> Approval Revision 2 не изменяет статусы T-009/T-010 на DONE, не создаёт DR-0006, не назначает Codex и не разрешает merge.  
> Новый Execution Authorization возможен **только** после CEO Approval Revision 2 и отдельного решения CEO.

---

## 1. Контекст

GitHub остаётся единственным Source of Record Genesis AI. После выполнения Stage 4 фактическое состояние GitHub изменилось, но операционные документы в `main` всё ещё отражают состояние до Stage 4.

Подтверждённые GitHub-факты:

- Issue [#19](https://github.com/kubzik96/genesis-ai/issues/19) закрыт как `completed`;
- PR [#20](https://github.com/kubzik96/genesis-ai/pull/20) merged методом squash;
- итоговый commit в `main`: [`99e6d153ac91b2bf25f9604d58fe51c387ba3d28`](https://github.com/kubzik96/genesis-ai/commit/99e6d153ac91b2bf25f9604d58fe51c387ba3d28);
- изменён только `bridge/QUEUE.md`: зарезервированный encoding-артефакт заменён на букву `в`;
- auto-merge не использовался;
- CI не настроен (`CI_NOT_CONFIGURED`).

По решению CEO результат Stage 4 определён как `PARTIAL PASS`: целевой diff прошёл независимый review и был принят через отдельные Gate 3 и Gate 4, однако Copilot runner не завершил реализацию автоматически, а полный One-Window цикл без ручных действий не достигнут.

Одновременно Codex фактически использовался для ограниченных операционных действий: чтения GitHub, проверки PR/Issue/SHA/diff, работы с Dify и подготовки управляемых изменений. Эти возможности и ограничения ещё не зафиксированы в GitHub и поэтому не являются официальной ролью Genesis AI.

Требуется привести Source of Record в соответствие фактам, не переписывая историю и не завышая степень завершённости T-009/T-010 или полномочия Codex.

### 1.1 Governance conflict (основание Revision 2)

После Approval Revision 1 и условного EA обнаружен конфликт:

1. DR-0004 / `specifications/INDEX.md` требуют обновлять INDEX **в том же commit**, что и спецификация.
2. Revision 1 §3.1 **не** включал `specifications/INDEX.md` в allowed files.
3. Candidate S-0001 Revision 2 не может иметь Status `Approved` до отдельного independent review и CEO Approval.
4. EA Revision 1 **TERMINATED** (Development Workflow §9: ошибка/пробел Specification, риск scope expansion).
5. PR #22 (implementation attempt) остаётся Draft без изменений до Approval Revision 2 и нового EA.

Revision 2 устраняет пробел Scope относительно DR-0004 **без** изменения целей и критериев результата S-0003.

---

## 2. Цель

После отдельного CEO Approval **Revision 2** и отдельного Execution Authorization:

1. синхронизировать документы Source of Record с подтверждённым результатом Stage 4;
2. зафиксировать `PARTIAL PASS`, PR #20, итоговый commit и закрытие Issue #19;
3. перевести T-009 из `WORKING` в `REVIEW`, но не в `DONE`;
4. сохранить T-010 в `REVIEW` до отдельного CEO acceptance;
5. определить роль Codex, её обязанности и жёсткие ограничения через новый DR-0006 и согласованное обновление `governance/Roles.md`;
6. сохранить Конституцию, DR-0005 и Development Workflow без изменений;
7. получить независимый review фактического Git diff и отдельное решение CEO до любого merge.

---

## 3. Scope

### 3.1 Разрешённые изменения при будущей реализации

Только следующие файлы:

- `specifications/S-0001-Genesis-One-Window-Execution-Spike.md` — подготовить **Revision 2** (см. §3.1.1);
- `specifications/INDEX.md` — синхронизировать запись S-0001 с Revision 2 **в том же commit**, в котором S-0001 Revision 2 получает Status `Approved` (DR-0004);
- `bridge/QUEUE.md` — синхронизировать факты Stage 4; T-009 → `REVIEW`; T-010 оставить `REVIEW`;
- `ACTIVE.md` — обновить текущий фокус и контрольную точку `main`;
- `MEMORY.md` — обновить устойчивые факты, не включая секреты;
- `decisions/DR-0006-Codex-Operational-Agent.md` — создать решение о роли Codex как дополнение к DR-0005;
- `decisions/INDEX.md` — добавить DR-0006 и обновить следующий номер;
- `governance/Roles.md` — отразить принятую DR-0006 роль и её границы.

Изменения должны быть выполнены в отдельной feature-ветке и ограниченном Pull Request. Разбиение реализации на **два Draft PR** (TWO_PRS) допускается и рекомендуется:

- **PR A** — Source-of-Record synchronization (`S-0001` Rev 2 lifecycle, `INDEX.md`, `QUEUE.md`, `ACTIVE.md`, `MEMORY.md`);
- **PR B** — `DR-0006` + `decisions/INDEX.md` + `governance/Roles.md`.

### 3.1.1 Lifecycle S-0001 Revision 2 (обязательный)

1. Candidate S-0001 Revision 2 сначала имеет Status **`In Review`** (не `Approved`).
2. Проходит **independent specification review**.
3. Требует **отдельного CEO Approval** Revision 2.
4. Только после CEO Approval получает Status **`Approved`**.
5. `specifications/INDEX.md` синхронизируется с S-0001 Revision 2 **в том же commit**, согласно DR-0004.
6. Related Documents: S-0003 указывается как Related Specification, **не** как Decision Record.

Исторические записи Stages 1–3 сохраняются. Итог Stage 4 / Gate 4 фиксируется как `PARTIAL PASS` без ложного объявления полного One-Window успеха.

### 3.2 Обязательное содержание синхронизации

- Stage 4: `PARTIAL PASS`, не `PASS`;
- T-009: `REVIEW`, не `DONE`;
- T-010: `REVIEW`, не `DONE`;
- PR #20: `MERGED`, squash commit `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`;
- Issue #19: `CLOSED / completed`;
- Copilot runner limitation описана как ограничение автоматизации, а не как полный отказ Copilot;
- independent review и отдельные решения CEO Gate 3 / Gate 4 отражены без трактовки `Approve` как auto-merge;
- `CI_NOT_CONFIGURED` указан явно;
- исторические записи о том, что Stage 4 ранее был `NOT_AUTHORIZED`, сохраняются как история, но не выдаются за текущее состояние.

### 3.3 Кандидатное определение роли Codex для DR-0006

Предлагаемое название: **Codex Operational Agent**.

Предлагаемая ответственность:

- читать и сверять GitHub Source of Record;
- готовить Draft Specifications и документационные изменения;
- выполнять разрешённые точечные изменения только в feature-ветке;
- создавать Draft PR в пределах явного CEO Authorization;
- проверять PR, Issue, HEAD SHA, changed files и diff;
- выполнять разрешённую настройку и тестирование операционных workflows;
- сообщать об ограничениях инструментов и останавливать работу при выходе за scope.

Обязательные ограничения:

- Codex не является CEO, COO, CTO, Chief Architect, Lead Engineer или Independent Reviewer по умолчанию;
- Codex не принимает стратегические или архитектурные решения вместо CEO;
- Codex не получает постоянного GitHub write, Execution Authorization или Merge Authorization;
- каждое write-действие требует явного ограниченного разрешения CEO;
- прямые изменения `main`, auto-merge и merge без отдельного CEO Merge Authorization запрещены;
- Codex не может быть единственным независимым reviewer собственной работы;
- Codex не расширяет scope, не меняет Constitution и не переписывает принятый DR-0005;
- фактические возможности описываются по проверенному поведению; недоступные права и `403` не маскируются;
- секреты, пароли, API-ключи и токены не сохраняются в Git и не запрашиваются в чате;
- новые расходы не разрешаются этой ролью и требуют отдельного решения CEO.

DR-0006 должен **дополнять**, а не заменять DR-0005.

### 3.4 Вне Scope

- изменение `governance/Constitution.md`;
- изменение `governance/DevelopmentWorkflow.md`;
- изменение `governance/Principles.md`, `governance/Standards.md`, Vision или Roadmap;
- изменение `bridge/HANDOFF.md` или архитектуры Bridge;
- изменение статуса T-006;
- перевод T-009 или T-010 в `DONE`;
- принятие T-010;
- выбор постоянного CTO;
- выбор долгосрочной платформы вместо Dify;
- изменение Broker, Dify workflow, Cloudflare, GitHub permissions или секретов;
- реализация One-Window функциональности;
- создание иных DR;
- direct push в `main`;
- auto-merge или merge без отдельного CEO Merge Authorization.

---

## 4. Требования

### 4.1 Evidence-first

1. Все утверждения о GitHub должны подтверждаться Git-артефактами, PR, Issue или commit.
2. Сообщения чата и вывод внешней модели не подменяют GitHub evidence.
3. Если для факта нет сохраняемого доказательства, он помечается как ограничение или решение CEO, а не как автоматически доказанный технический результат.
4. История прежних ограничений и staged authorizations сохраняется.

### 4.2 Consistency

5. `S-0001`, `QUEUE.md`, `ACTIVE.md` и `MEMORY.md` не должны противоречить друг другу в текущем статусе Stage 4 и T-009/T-010.
6. `Roles.md`, DR-0005 и будущий DR-0006 не должны приписывать Codex полномочия COO, CTO, Chief Architect или Lead Engineer.
7. `DevelopmentWorkflow.md` и Constitution остаются неизменными.
8. GitHub остаётся единственным Source of Record.
9. `specifications/INDEX.md` согласован с фактическим Status/Revision каждой Specification (DR-0004).

### 4.3 Governance gates

10. Candidate Revision (включая Revision 2) проходит независимый specification review.
11. Только CEO может перевести Revision в `Approved`.
12. Approval Specification / Revision **не** является Execution Authorization.
13. Реализация начинается только после отдельного ограниченного Execution Authorization CEO на **утверждённую** Revision.
14. Реализация выполняется в feature-ветке и PR.
15. Review проводится по актуальному HEAD и фактическому diff.
16. Ready for review не означает разрешение на merge.
17. Merge и auto-merge запрещены без отдельного CEO Merge Authorization.
18. EA автоматически прекращается при ошибке Specification, необходимости изменения Scope, scope expansion или указании CEO (Development Workflow §9).

---

## 5. Dependencies

- `governance/Constitution.md`;
- `governance/DevelopmentWorkflow.md` Revision 2;
- DR-0004 — Repository of Approved Specifications;
- DR-0005 — Operational AI Team Roles;
- S-0001 (Revision 1 in main; Revision 2 — отдельный lifecycle §3.1.1);
- GitHub Issue #19, PR #20 и commit `99e6d153…`;
- независимый review candidate S-0003 Revision 2;
- отдельные решения CEO: Approval Revision 2, Execution Authorization и Merge Authorization.

---

## 6. Assumptions

- commit `99e6d153…` остаётся в истории `main`;
- PR #20 и Issue #19 остаются доступными как доказательства;
- T-009 не может стать `DONE`, пока полный воспроизводимый One-Window цикл не принят CEO;
- T-010 не может стать `DONE` без отдельного CEO acceptance;
- название и формулировки роли Codex могут быть скорректированы по результатам review до Approval DR-0006;
- CI может оставаться не настроенным, но это должно быть указано явно;
- PR #22 остаётся Draft до Approval Revision 2 и нового EA; не является действующей реализацией под EA Revision 1.

---

## 7. Критерии готовности реализации (Acceptance Criteria)

- [ ] Изменены только разрешённые файлы §3.1 (включая `specifications/INDEX.md` при публикации S-0001 Rev 2).
- [ ] Stage 4 в текущем состоянии указан как `PARTIAL PASS`.
- [ ] T-009 указан как `REVIEW`, но не `DONE`.
- [ ] T-010 остаётся `REVIEW`, но не `DONE`.
- [ ] Зафиксированы PR #20, Issue #19 и полный squash commit SHA.
- [ ] S-0001 Revision 2 прошёл lifecycle §3.1.1 (In Review → review → CEO Approval → Approved).
- [ ] `specifications/INDEX.md` синхронизирован с Approved S-0001 Revision 2 в том же commit.
- [ ] Зафиксировано `CI_NOT_CONFIGURED` без трактовки как успешного CI.
- [ ] Историческое `Stage 4 NOT_AUTHORIZED` сохранено только как прошлое состояние.
- [ ] Ограничение Copilot runner описано без преувеличения результата.
- [ ] Создан DR-0006, который дополняет DR-0005.
- [ ] `decisions/INDEX.md` согласован с DR-0006.
- [ ] `Roles.md` содержит роль Codex с явными границами.
- [ ] Codex не назначен COO, CTO, Chief Architect, Lead Engineer или Independent Reviewer по умолчанию.
- [ ] Constitution, Development Workflow, DR-0005 и HANDOFF не изменены.
- [ ] Секреты и значения токенов отсутствуют.
- [ ] Реализация находится в feature-ветке и PR (рекомендуется TWO_PRS).
- [ ] Фактический HEAD/diff прошёл независимый review.
- [ ] Merge не выполнен до отдельного CEO Merge Authorization.
- [ ] Post-merge verification выполнена до любого решения о `DONE`.

---

## 8. Способы проверки

1. Сверить PR #20, Issue #19 и commit `99e6d153…` через GitHub.
2. Проверить список changed files implementation PR против §3.1.
3. Сравнить текущие статусы и факты в `S-0001`, `INDEX.md`, `QUEUE.md`, `ACTIVE.md`, `MEMORY.md`.
4. Проверить DR-0006 и `Roles.md` на соответствие ограничениям §3.3.
5. Убедиться, что diff не содержит Constitution, Development Workflow, DR-0005, HANDOFF, код или секреты.
6. Зафиксировать `CI_NOT_CONFIGURED`, если CI по-прежнему отсутствует.
7. Получить независимый verdict по актуальному HEAD.
8. После отдельного merge — повторно прочитать файлы из `main` и только затем рассматривать любые дальнейшие изменения статусов, особенно перевод в `DONE`.

---

## 9. Ожидаемые выходные артефакты

- согласованный Source of Record после Stage 4;
- S-0001 Revision 2 с сохранённой историей и актуальным результатом Stage 4;
- `specifications/INDEX.md`, согласованный с Approved Revision;
- QUEUE / ACTIVE / MEMORY без противоречий по T-009/T-010;
- DR-0006 о роли Codex;
- обновлённый `governance/Roles.md`;
- ссылки на implementation PR, независимый review и post-merge verification;
- отсутствие изменений Constitution, Development Workflow и DR-0005.

---

## 10. Необходимость Decision Record

- [x] **DR-0006 обязателен**, потому что формализация Codex меняет операционную модель ролей и полномочий.
- [x] DR-0006 должен дополнять DR-0005 и не переписывать принятое решение.
- [ ] Approval этой Specification / Revision не создаёт и не принимает DR-0006.
- [ ] Отдельный DR о долгосрочной платформе остаётся вне Scope.

---

## 11. Риски и митигации

| Риск | Митигация |
|---|---|
| Устаревшие документы продолжают считаться текущим состоянием | Evidence-first синхронизация SoR-документов + INDEX |
| T-009 ошибочно объявляется DONE | Явно ограничить статус значением `REVIEW` |
| T-010 принимается неявно | Сохранить `REVIEW`; требовать отдельный CEO acceptance |
| Codex получает слишком широкую роль | DR-0006 с per-task authorization и запретом самостоятельного merge |
| Codex проверяет собственную работу | Обязательный независимый reviewer |
| История staged authorization переписывается | Сохранять прежние записи как историю и отдельно указывать текущее состояние |
| Отсутствие CI трактуется как успех | Явный `CI_NOT_CONFIGURED` |
| Scope расширяется до платформы или инфраструктуры | Закрытый список файлов и запретов §3 |
| INDEX рассинхронизирован со Specification | §3.1 + DR-0004: INDEX в allowed files; same-commit update |
| Premature Approved на candidate Revision | §3.1.1 lifecycle: In Review → Approval → Approved |
| Секреты попадают в SoR | Хранить только аудит наличия/границ, без значений секретов |

---

## 12. История изменений

| Revision | Дата | Автор | Статус | Что изменено |
|---|---|---|---|---|
| 1 | 2026-08-07 | Codex — по разрешению CEO | **Approved** | Создан Draft для синхронизации SoR после Stage 4 и определения роли Codex; реализация и DR-0006 не разрешены; CEO Approval 2026-08-07 |
| 2 | 2026-08-07 | Grok — Chief Architect | **In Review** | **Governance correction (Minor):** добавить `specifications/INDEX.md` в §3.1 allowed files; определить lifecycle S-0001 Revision 2 (In Review → review → CEO Approval → Approved + INDEX same commit); устранить конфликт с DR-0004; зафиксировать EA Revision 1 **TERMINATED**; цели/результаты (PARTIAL PASS, T-009 REVIEW, T-010 REVIEW, DR-0006 boundaries, TWO_PRS) **не** расширены |
