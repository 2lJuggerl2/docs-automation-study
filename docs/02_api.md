# REST API

## Источник истины

Спецификация хранится в файле `openapi/openapi.yaml` в формате OpenAPI 3.1.
Отдельного описания API в Word нет и не будет: любая правка контракта — это коммит в
YAML-файл, который видно в истории Git построчно.

Интерактивная документация собирается из этого же файла и открывается в
[Swagger UI](swagger/index.html).

## Базовый адрес

| Контур | Адрес |
| --- | --- |
| Продуктивный | `https://api.ulr.local/api/v1` |
| Локальный стенд | `http://localhost:8080/api/v1` |

## Ресурсы

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/works` | Список работ с фильтром по дисциплине |
| `POST` | `/works` | Добавить работу в каталог |
| `GET` | `/works/{workId}` | Получить работу по идентификатору |
| `GET` | `/students` | Список студентов с фильтром по группе |
| `GET` | `/submissions` | Список сдач с фильтрами |
| `POST` | `/submissions` | Зафиксировать сдачу работы |
| `PATCH` | `/submissions/{submissionId}` | Выставить оценку |

## Статусы сдачи

- `submitted` — работа предъявлена, ожидает проверки;
- `graded` — оценка выставлена;
- `returned` — работа возвращена на доработку.

## Коды ответов

| Код | Когда возвращается |
| --- | --- |
| `200` | Успешное чтение или изменение |
| `201` | Объект создан |
| `404` | Объект с указанным идентификатором не найден |
| `409` | Сдача по этой паре «студент — работа» уже существует |
| `422` | Входные данные не прошли валидацию |

## Пример запроса

```http
POST /api/v1/submissions HTTP/1.1
Host: api.ulr.local
Content-Type: application/json

{
  "studentId": 41,
  "workId": 7
}
```

Ответ:

```json
{
  "id": 132,
  "studentId": 41,
  "workId": 7,
  "status": "submitted",
  "submittedAt": "2026-02-16T09:14:03Z",
  "grade": null
}
```

## Пример ошибки валидации

```json
{
  "code": "validation_error",
  "errors": [
    { "field": "workId", "message": "field required" }
  ]
}
```

Полный перечень схем — `Work`, `WorkInput`, `Student`, `Submission`, `Status`,
`Error`, `ValidationError` — описан в разделе `components.schemas` файла
`openapi/openapi.yaml`.
