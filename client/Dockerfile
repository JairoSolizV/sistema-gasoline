# Panel React: se compila con Vite y se sirve con nginx. El panel llama a /api,
# que nginx proxya a la API (servicio "server" del compose).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY shared/ shared/
COPY client/ client/
RUN npm run build --workspace @taller/client

FROM nginx:alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
