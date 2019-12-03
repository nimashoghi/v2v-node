FROM balenalib/raspberrypi3-alpine-node

RUN ["cross-build-start"]

RUN apk add --no-cache alpine-sdk linux-headers python-dev

WORKDIR /app

COPY ./package.json .
RUN yarn install --production=true

ADD ./dist/ ./
ENV NODE_ENV=production

RUN ["cross-build-end"]

CMD node index.js
