# Dockerfile (substitua o existente)
FROM node:18-alpine

WORKDIR /app

# copiar apenas package.json e package-lock.json se existir
COPY package*.json ./

# instalar dependências de produção
# use --omit=dev para npm v7+ (mais novo) ou --production para compatibilidade
RUN npm install --omit=dev

# copiar o restante do código
COPY . .

# construir/transpilar se necessário (opcional)
# RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
