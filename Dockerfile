FROM node:6

COPY package.json /app/package.json
RUN npm install

COPY source/ /app/source/
COPY tests/ /app/tests/
WORKDIR /app

RUN npm run build

ENTRYPOINT [ "npm", "run", "test" ]
