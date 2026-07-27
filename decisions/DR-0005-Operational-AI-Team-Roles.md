# DR-0005 — Operational AI Team Roles

## Идентификатор

DR-0005

## Название

Operational AI Team Roles

## Статус

Принято

## Дата

2026-07-27

## Автор решения

CEO Genesis AI

---

# Контекст

После Stage 3 One-Window (Issue #15) и синхронизации документации операционная модель команды расходилась с текстами Roles / MEMORY / ACTIVE:

- ChatGPT больше не исполняет CTO;
- Grok действует как Chief Architect;
- GitHub Copilot реализует инженерные задачи (DR-0002);
- постоянный CTO не выбран (T-002…T-005).

Требовалось зафиксировать модель Decision Record’ом без изменения Constitution.

---

# Цель

Утвердить операционные роли ИИ-команды и границы полномочий, устранить противоречие «ChatGPT = временный CTO».

---

# Решение

1. **ChatGPT = COO** (процесс, координация, analysis/review). GitHub write **недоступен**.
2. **Grok = Chief Architect** (архитектурная оценка, dissent / Stop the Line; GitHub execution только по явному CEO Authorization). Не принимает решения вместо CEO. Не может быть единственным independent reviewer собственной реализации.
3. **GitHub Copilot = Lead Engineer (GitHub Engineer)** — продолжение и уточнение DR-0002.
4. **CTO = вакансия**; отбор остаётся в **T-002…T-005**.
5. Generic-роли **Developer, Architect, QA, Research, Documentation** сохраняются.
6. **DR-0002** продолжает действовать в части назначения Copilot; утверждения DR-0002 о ChatGPT как CTO и устаревшей операционной схеме **частично заменены** настоящим DR-0005.
7. **Constitution не изменяется.**
8. Никакая роль не получает автоматического Execution Authorization, GitHub write или Merge Authorization.

---

# Причины

- фактическая работа команды уже следовала этой модели;
- устранение ложного статуса «временный CTO»;
- явное разделение process (COO), architecture (Chief Architect) и implementation (Lead Engineer).

---

# Последствия

## Положительные

- единый SoR ролей в Roles.md + DR-0005;
- меньше противоречий для агентов и review.

## Риски

- путаница со старыми формулировками DR-0002 — смягчается примечанием в DR-0002 и обновлением Roles.

---

# План выполнения

1. Обновить `governance/Roles.md`.
2. Обновить `governance/DevelopmentWorkflow.md` (Revision 2) без имён исполнителей в общей таблице ролей Workflow.
3. Обновить `decisions/INDEX.md`.
4. Добавить примечание в `decisions/DR-0002-GitHub-Copilot.md`.
5. Синхронизировать README / MEMORY / ACTIVE в рамках PR #17.

---

# Проверка результата

- DR-0005 в `decisions/`;
- INDEX содержит DR-0005; следующий номер DR-0006; DR-0003 зарезервирован;
- Roles отражает модель выше;
- Constitution без изменений.

---

# Связанные документы

- `governance/Roles.md`
- `governance/DevelopmentWorkflow.md`
- `governance/Constitution.md`
- `decisions/DR-0002-GitHub-Copilot.md`
- `decisions/INDEX.md`
- `bridge/QUEUE.md` (T-002…T-005)

---

# История изменений

- 2026-07-27 — решение создано и принято CEO.
