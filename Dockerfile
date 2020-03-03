FROM node:alpine

RUN apk add --no-cache alpine-sdk linux-headers python-dev

WORKDIR /app

COPY ./package.json .
RUN yarn install --production=true

ADD ./dist/src/ ./
ENV NODE_ENV=production

CMD node index.js
