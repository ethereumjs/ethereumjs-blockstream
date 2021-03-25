FROM node:14-alpine

COPY package.json /app/package.json
WORKDIR /app
RUN npm ci

COPY tsconfig.json /app/tsconfig.json
COPY source/ /app/source/
COPY tests/ /app/tests/
COPY typings/ /app/typings/

RUN npx tsc -b

ENTRYPOINT [ "npm", "test" ]
