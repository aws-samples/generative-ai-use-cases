FROM public.ecr.aws/docker/library/node:latest

WORKDIR /app

RUN apt-get update -y

COPY package.json package-lock.json ./

RUN npm ci

COPY app.ts ./

RUN npm run bundle

FROM public.ecr.aws/docker/library/node:latest

WORKDIR /app

COPY --from=0 /app/dist/app.js ./

CMD ["node", "app.js"]
