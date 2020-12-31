FROM node:14 as builder

WORKDIR /build

COPY . .

RUN npm install && npm run build

FROM node:14

WORKDIR /app

COPY --from=builder /build/build .

COPY --from=builder /build/node_modules/ ./node_modules/

 ENTRYPOINT ["node", "/app/index.js"]