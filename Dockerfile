FROM node:20-alpine

# mariadb-client fornece o binário `mysqldump`, usado pelo backup automático
# do banco (server/backup.js) — compatível com MySQL.
RUN apk add --no-cache mariadb-client

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public

EXPOSE 3000

CMD ["node", "server/index.js"]
