FROM node:18.1.0 as appbuild

WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:18.1.0

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=appbuild /app/out ./out
CMD ["npm", "start"]