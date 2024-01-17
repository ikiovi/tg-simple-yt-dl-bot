FROM node:20.9-alpine as appbuild

WORKDIR /app
COPY . .
RUN npm ci --omit=dev
RUN npm run build

FROM node:20.9-alpine

WORKDIR /app
COPY package*.json ./
COPY --from=appbuild /app/node_modules ./node_modules
COPY --from=appbuild /app/out ./out

RUN apk update
RUN apk add
RUN apk add ffmpeg
ENV FFMPEG_PATH ffmpeg

EXPOSE 80
ENV PORT 80

CMD npm start