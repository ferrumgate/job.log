FROM node:16.13.2-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends openssl \
    ca-certificates gnupg iputils-ping
#Create app directory
WORKDIR /usr/src/app



ADD node_modules/rest.portal2 /usr/src/rest.portal/build/src
WORKDIR /usr/src/rest.portal/build/src
RUN npm install
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
#RUN sed -i s#../rest.portal/build/src#../rest.portal#g package-lock.json
#RUN sed -i s#../rest.portal/build/src#../rest.portal#g package.json
RUN npm install







# If you are building your code for production
# RUN npm ci --only=production

ADD build/src /usr/src/app/build/src
WORKDIR /usr/src/app
#RUN chown -R  node /usr/src/app
### delete sensitive test data


USER node
CMD ["npm","run","startdocker"]
#CMD ["node","./build/src/main.js"]