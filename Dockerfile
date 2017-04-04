FROM node:6

COPY package.json /app/package.json
WORKDIR /app
RUN npm install

COPY tsconfig.json /app/tsconfig.json
COPY source/ /app/source/
COPY tests/ /app/tests/
COPY typings/ /app/typings/

RUN npm run build

ENTRYPOINT [ "npm", "test" ]
