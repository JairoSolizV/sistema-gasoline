# API del taller. Monorepo: se copia todo y se instala desde la raíz (workspaces).
FROM node:22-slim AS base
WORKDIR /app
# openssl: requerido por Prisma en debian-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY shared/ shared/
COPY server/ server/
COPY docs/ docs/

WORKDIR /app/server
RUN npx prisma generate

EXPOSE 3001
# el CMD real lo define docker-compose (migrate + seed + start)
CMD ["node", "--import", "tsx", "src/server.ts"]
