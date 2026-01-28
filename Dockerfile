# Dockerfile completo para produção
FROM node:18-alpine AS base

WORKDIR /app

# copiar package.json primeiro para usar cache
COPY package*.json ./

# instalar dependências (produção)
RUN npm install --omit=dev

# copiar o restante do projeto
COPY . .

# garantir diretório de dados e permissões
RUN mkdir -p /app/data && chown -R node:node /app

# expõe porta (informativo)
EXPOSE 3000

# rodar como usuário não-root
USER node

# comando padrão
CMD ["node", "server.js"]
