FROM node:18.13.0-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends openssl \
    ca-certificates gnupg iputils-ping
#Create app directory
WORKDIR /usr/src/app
RUN sed -i 's/providers = provider_sect/#providers = provider_sect/g' /etc/ssl/openssl.cnf
RUN sed -i 's/^MinProtocol.*/MinProtocol = TLSv1/g' /etc/ssl/openssl.cnf
RUN sed -i 's/^CipherString.*/CipherString = DEFAULT:@SECLEVEL=1/g' /etc/ssl/openssl.cnf

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

RUN mkdir -p /var/run/ferrumgate && chown node:node /var/run/ferrumgate
USER node

CMD ["npm","run","startdocker"]
#CMD ["node","./build/src/main.js"]