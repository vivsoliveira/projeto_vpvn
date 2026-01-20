# Dockerfile (produção)
FROM node:18-alpine

WORKDIR /app

# Instala dependências (usa package-lock se houver)
COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
