# Estágio 1: Build da aplicação Node.js (Vite)
FROM node:18-alpine as build
WORKDIR /app

# Copia os arquivos de dependências e instala
COPY package*.json ./
RUN npm install

# Copia o resto do código e faz o build (gera a pasta /dist)
COPY . .
RUN npm run build

# Estágio 2: Servidor Web Nginx
FROM nginx:alpine

# Remove a configuração padrão do Nginx que vem na imagem
RUN rm /etc/nginx/conf.d/default.conf

# Copia a NOSSA configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/

# Copia os arquivos compilados do Vite para o Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]