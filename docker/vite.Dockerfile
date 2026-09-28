# Node + pnpm для dev-профиля (в образе node pnpm из коробки нет).
# Запускает только vite-сервер: php-процессы живут в сервисе app-dev.
FROM node:20

RUN corepack enable \
    && corepack prepare pnpm@9 --activate \
    && pnpm --version

WORKDIR /var/www/html

EXPOSE 5173

# install только если node_modules пуст (volume dev-node-modules переживает рестарты),
# store тоже на volume — повторные установки не качают tarballs заново.
CMD ["sh", "-c", "if [ ! -f node_modules/.modules.yaml ]; then pnpm install --frozen-lockfile --store-dir /pnpm/store; fi && exec pnpm exec vite --host 0.0.0.0 --port 5173 --strictPort"]
