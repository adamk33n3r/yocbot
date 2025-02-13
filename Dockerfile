FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest
RUN corepack enable
COPY . /app
COPY src/config.json /app/src/local.config.json
WORKDIR /app

FROM base AS prod-deps
RUN apk add --update --no-cache g++ make py3-pip
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN apk add --update --no-cache g++ make py3-pip
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

VOLUME /tmp/keys/.firestore-creds.json /app/.data /app/dist/src/local.config.json

CMD [ "pnpm", "start" ]
