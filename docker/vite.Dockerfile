# Node + pnpm для dev-профиля (в образе node pnpm из коробки нет).
# Запускает только vite-сервер: php-процессы живут в сервисе app-dev.
FROM node:20

RUN corepack enable \
    && corepack prepare pnpm@9 --activate \
    && pnpm --version

WORKDIR /var/www/html

EXPOSE 5173

CMD ["sh", "-c", "pnpm install --frozen-lockfile && exec pnpm exec vite --host 0.0.0.0 --port 5173 --strictPort"]
