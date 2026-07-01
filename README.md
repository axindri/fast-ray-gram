# Fast Ray Gram

Веб-приложение для управления VPN-подписками: личный кабинет, админка, интеграция с **3X-UI** и оплатой через **TimeWeb**.

Стек: FastAPI, SQLite, SPA-фронтенд.

## Переменные `.env`

Скопируйте шаблон и заполните значения:

```bash
cp .env.example .env
```

| Переменная | Описание |
|---|---|
| `APP__JWT_SECRET` | Секрет для JWT-токенов пользователей |
| `APP__SUPERUSER_TOKEN` | Токен входа суперпользователя |
| `APP__DEBUG` | Режим отладки приложения (`true` / `false`) |
| `XUI__URL` | URL панели 3X-UI |
| `XUI__SUB_URL` | URL подписок 3X-UI |
| `XUI__API_KEY` | API-ключ 3X-UI |
| `TIMEWEB__TOKEN` | API-токен TimeWeb |
| `TIMEWEB__PAYER_ID` | ID плательщика в TimeWeb |
| `SQLITE_WEB_PASSWORD` | Пароль для SQLite Web в dev (пусто — без пароля) |
| `APP_PORT` | Порт приложения на хосте (по умолчанию `8000`) |
| `SQLITE_WEB_PORT` | Порт SQLite Web в dev (по умолчанию `8081`) |

## Быстрый старт

**Разработка** (hot reload, SQLite Web):

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- http://localhost:8000 — приложение
- http://localhost:8081 — SQLite Web

**Продакшен** (бэкенд + собранный React-фронтенд в одном контейнере):

```bash
cp .env.example .env
docker compose up -d --build
```

- http://localhost:8000 — приложение
