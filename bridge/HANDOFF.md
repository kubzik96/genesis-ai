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

## HANDOFF: T-006 — Реализовать Orchestrator v0.1

Статус задачи: WORKING  
Версия спецификации: Revision 2  
Исполнитель: GitHub Copilot  
Создано: 2026-07-23  
Утверждено: 2026-07-23

### Контекст

**Что было сделано до этого:**
- Создана инфраструктура Bridge (QUEUE.md, HANDOFF.md)
- Утверждены ограничения версии v0.1 (без сетевого взаимодействия и API)
- Проведён независимый review (Grok, ChatGPT) для корректировки архитектуры

**Зачем это нужно:**  
Genesis AI требует базовой системы управления очередью задач и передачи контекста между агентами без внешних зависимостей. Orchestrator v0.1 — минимальная реализация, пригодная для локального использования.

**Связь с другими задачами:**
- T-005 использует результаты T-006 для оформления Decision Record
- T-004 будет использовать Orchestrator для испытания ИИ-моделей

### Задача

**Что нужно сделать:**  
Реализовать минимальный Orchestrator v0.1 со следующими компонентами:

1. **models.py** — модель Task, TaskStatus и вспомогательные структуры
2. **state_machine.py** — машина состояний для валидации переходов между статусами
3. **event_log.py** — JSONL-журнал операций (append-only, UTC timestamps)
4. **orchestrator.py** — ядро системы управления очередью и контекстом
5. **main.py** — минимальная точка входа для локального запуска
6. **registry.json** — реестр доступных агентов
7. **tests/** — unittest-тесты для всех компонентов
8. **README.md** — документация версии v0.1

**Структура каталогов:**

```text
orchestrator/
├── __init__.py
├── models.py
├── state_machine.py
├── event_log.py
├── orchestrator.py
├── main.py
└── README.md

agents/
├── __init__.py
└── registry.json

system/
├── __init__.py
└── events/
    └── .gitkeep

tests/
├── __init__.py
├── test_models.py
├── test_state_machine.py
├── test_event_log.py
├── test_registry.py
└── test_orchestrator.py

.gitignore
```

**Реестр агентов (`agents/registry.json`):**

```json
{
  "chatgpt": {
    "role": "coo",
    "description": "Chief Operating Officer (ChatGPT)"
  },
  "grok": {
    "role": "chief_architect",
    "description": "Chief Architect (Grok)"
  },
  "github-copilot": {
    "role": "lead_engineer",
    "description": "Lead Engineer (GitHub Copilot)"
  },
  "cursor": {
    "role": "execution_engineer",
    "description": "Execution Engineer (Cursor)"
  },
  "human-ceo": {
    "role": "ceo",
    "description": "CEO (Human)"
  }
}
```

**Ограничения:**

- Не создавать REST API, Web API, GitHub API
- Не реализовывать Dispatcher, Workflow Engine
- Не добавлять сетевое взаимодействие
- Не включать setup.py, pyproject.toml, requirements.txt
- EventLog должен быть JSONL файлом (не список Python)
- State Machine должна быть отдельным модулем
- Все тесты должны использовать unittest
- Каждый модуль отвечает только за одну область

**Что менять нельзя:**

- governance/Constitution.md
- governance/Roles.md
- bridge/README.md
- MEMORY.md

### Критерии готовности

Задача считается завершённой, если:

- [ ] Создана структура каталогов: orchestrator/, agents/, system/, tests/
- [ ] Реализован models.py с классом Task и перечислением TaskStatus
- [ ] Реализован state_machine.py с проверкой допустимых переходов
- [ ] Реализован event_log.py с JSONL-хранилищем (append-only, UTC)
- [ ] Реализован orchestrator.py с операциями управления очередью
- [ ] Создан agents/registry.json с 5 записями агентов
- [ ] Реализован main.py для локального запуска
- [ ] Все компоненты имеют docstring на русском языке
- [ ] Создан README.md с описанием Orchestrator v0.1
- [ ] Создан tests/test_registry.py для проверки JSON реестра
- [ ] Все остальные тесты используют unittest
- [ ] Все тесты проходят: `python -m unittest discover -s tests -v`
- [ ] Минимальный запуск работает: `python -m orchestrator.main`
- [ ] Нет файлов, выходящих за пределы утверждённого scope
- [ ] bridge/QUEUE.md обновлена до REVIEW

Проверка:

- [ ] CEO прочитал и утвердил реализацию
- [ ] Все тесты проходят полностью
- [ ] Результат сохранён в GitHub
- [ ] Окончательный переход REVIEW → DONE не выполняется исполнителем

### Входные данные

**Файлы для справки:**
- governance/Constitution.md
- governance/Roles.md
- MEMORY.md
- bridge/README.md

**Документы, которые НЕ менять:**
- governance/*.md
- MEMORY.md
- bridge/README.md

### Выходные данные

**Что должно быть создано:**

Директория `orchestrator/`:
- orchestrator/__init__.py
- orchestrator/models.py
- orchestrator/state_machine.py
- orchestrator/event_log.py
- orchestrator/orchestrator.py
- orchestrator/main.py
- orchestrator/README.md

Директория `agents/`:
- agents/__init__.py
- agents/registry.json

Директория `system/`:
- system/__init__.py
- system/events/.gitkeep

Директория `tests/`:
- tests/__init__.py
- tests/test_models.py
- tests/test_state_machine.py
- tests/test_event_log.py
- tests/test_registry.py
- tests/test_orchestrator.py

Файл конфигурации:
- .gitignore (исключает system/events/events.jsonl, но не .gitkeep)

**Формат результата:**
- Python 3.8+ синтаксис
- Docstring на русском языке для каждого модуля и класса
- JSONL формат для event_log (одна запись = одна строка JSON с UTC timestamp)
- Все тесты совместимы с unittest
- Registry в формате JSON с обязательными полями: role, description

---

## Правила создания HANDOFF

1. HANDOFF создаётся ДО начала работы, когда задача переходит в READY;
2. Исполнитель может задать вопросы перед началом работы;
3. При завершении задачи результат помещается в REVIEW;
4. HANDOFF остаётся в истории как справка для следующих сессий.
