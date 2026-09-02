# Project Rules — обязательно для ИИ и человека

> **Правило №1 — Логика только в хуках (composables), не в компонентах**
> - Любая логика приложения (состояние, запросы, валидация, сайд-эффекты, вычисления, обработка событий) выносится в отдельный `composable` в `resources/js/composables/` или `resources/js/queries/` / `stores/`.
> - Компонент (`*.vue`) отвечает только за **отображение** и вызов хука: `const { state, actions } = useMyFeature()`.
> - Запрещено писать `axios`, `useQuery`, `watch`, сложную логику напрямую в `<script setup>` компонента — переноси в `useXxx.ts`.
> - Именование: `useFeatureName.ts` (camelCase, префикс `use`), один хук = одна ответственность, экспортирует `ref/computed/methods`.
> - ИИ-ассистент перед генерацией кода обязан предложить/создать хук, а не вставлять логику в компонент. При ревью — переносить логику из компонента в хук.

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
</laravel-boost-guidelines>
