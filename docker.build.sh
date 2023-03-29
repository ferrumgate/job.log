#!/bin/bash

set -e
npm run build
rm -rf node_modules/rest.portal2
mkdir -p node_modules/rest.portal2
cp -R node_modules/rest.portal/* node_modules/rest.portal2
version=$(cat package.json | grep version | cut -d: -f2 | tr -d , | tr -d \" | tr -d " ")
docker build -t job.log . $1
docker tag job.log job.log:$version
echo "job.log:$version builded"
docker tag job.log registry.ferrumgate.zero/ferrumgate/job.log:$version
docker tag job.log registry.ferrumgate.zero/ferrumgate/job.log:latest
docker tag job.log ferrumgate/job.log:$version

while true; do
    read -p "do you want push to local registry y/n " yn
    case $yn in
    [Yy]*)
        docker push registry.ferrumgate.zero/ferrumgate/job.log:$version
        docker push registry.ferrumgate.zero/ferrumgate/job.log:latest
        break
        ;;
    [Nn]*) exit ;;
    *) echo "please answer yes or no." ;;
    esac
done
