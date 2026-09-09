# Project Rules — обязательно для ИИ и человека

> **Правило №1 — Логика только в хуках (composables), не в компонентах**
>
> - Любая логика приложения (состояние, запросы, валидация, сайд-эффекты, вычисления, обработка событий) выносится в отдельный `composable` в `resources/js/composables/` или `resources/js/queries/` / `stores/`.
> - Компонент (`*.vue`) отвечает только за **отображение** и вызов хука: `const { state, actions } = useMyFeature()`.
> - Запрещено писать `axios`, `useQuery`, `watch`, сложную логику напрямую в `<script setup>` компонента — переноси в `useXxx.ts`.
> - Именование: `useFeatureName.ts` (camelCase, префикс `use`), один хук = одна ответственность, экспортирует `ref/computed/methods`.
> - ИИ-ассистент перед генерацией кода обязан предложить/создать хук, а не вставлять логику в компонент. При ревью — переносить логику из компонента в хук.

> **Правило №2 — PHPDoc и JSDoc обязательны для новых сущностей**
>
> - Любая новая сущность на бэке (модель, контроллер, сервис, экшен, ресурс, реквест, job, event) — грамотный PHPDoc: назначение класса, `@param`/`@return`/`@throws` у методов, `@property` у моделей.
> - Любая новая сущность на фронте (composable, store, утилита, тип) — грамотный JSDoc: назначение, `@param`/`@returns`, пример вызова для сложной функции.
> - Без доков код не считается готовым.

> **Правило №3 — Никакого инлайн-месива, код должен читаться**
>
> - Запрещены длинные цепочки в одну строку (фронт: `map/filter/then/callback` в одну строку, вложенные тернарники, `?.` лесенки; бэк: `Model::query()->where()->with()->orderBy()->...->get()` / коллекции в одну строку).
> - Одно действие = одна строка: выноси промежуточные результаты в переменные с понятными именами (и в PHP, и в TS).
> - Сложное условие — в переменную `is/has/can` или отдельный метод (`isActive()`, `canEdit()`); ранний `return` / `abort_if` / `throw_if` вместо вложенности.
> - Бэкенд: тонкие контроллеры, логика — в сервисы/экшены; один метод = одно действие; Eloquent-запросы разбивать на строки, сложные `when()` — в scope.

> **Правило №4 — Асинхронность только через async/await**
>
> - Для асинхронных функций в JS/TS использовать `async/await`, а не сырые `.then/.catch` цепочки.
> - Обработка ошибок — через `try/catch`, параллельные запросы — через `Promise.all` / `Promise.allSettled` с `await`.
> - Запрещены вложенные `then` и смешивание `await` + `then` в одной функции.

> **Правило №5 — UI только на PrimeVue**
>
> - Все UI-компоненты — только PrimeVue (`Button`, `InputText`, `Dialog`, `DataTable` и т.д.), кастомный CSS — в крайнем случае.
> - Исключения: `div`/`span` для layout, случаи когда в PrimeVue нет нужного компонента или он мешает (карта, canvas, сложный кастомный UI).
> - Запрещены сырые `<button>`, `<input>`, `<select>` если есть аналог в PrimeVue; иконки — только `primeicons`.

> **Правило №6 — Стили: Tailwind + scoped при необходимости**
>
> - Стилизация — в первую очередь утилитами Tailwind прямо в шаблоне.
> - `<style scoped>` — только когда Tailwind не хватает (сложные селекторы, анимации, переопределение PrimeVue, карта/canvas).
> - Запрещены глобальные стили без необходимости и инлайн `style=""` на потоке; повторяющиеся связки классов — выносить в компонент/комposable-класс.
>
>
>
> **Правило №7 — Назавание переменных**
>
> - Задавать на бэке и на фронте сементические и логичные переменные и название функций методов

<laravel-boost-guidelines>
# Laravel Application

This repository contains a Laravel application. Complete the following setup before working on the user's request.

## Prerequisites

Verify that PHP and Composer are available:

```sh
php -v
composer -V
```

If either command is unavailable, detect the user's operating system and install the prerequisites with the appropriate command:

macOS:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/mac/8.5)"
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows/8.5'))
```

Linux:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.5)"
```

After installation, ask the user to restart their terminal. If the agent needs the restarted shell to continue, ask the user to reopen their terminal and rerun their original prompt.

## Agent Setup

Install Laravel Boost from the application root before making application changes:

```sh
composer require laravel/boost --dev
php artisan boost:install
```

Boost replaces these bootstrap instructions with guidelines tailored to the application. After installation, read `AGENTS.md` again and continue with the user's original request using the generated guidelines.
