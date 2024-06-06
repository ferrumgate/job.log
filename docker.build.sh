#!/bin/bash

set -e
first="$1"
second="$2"
npm run build
rm -rf node_modules/rest.portal2
mkdir -p node_modules/rest.portal2
cp -R node_modules/rest.portal/* node_modules/rest.portal2
version=$(cat package.json | grep version | cut -d: -f2 | tr -d , | tr -d \" | tr -d " ")
docker build -t job.log .
docker tag job.log job.log:"$version"
echo "job.log:$version builded"
docker tag job.log registry.ferrumgate.zero/ferrumgate/job.log:"$version"
docker tag job.log registry.ferrumgate.zero/ferrumgate/job.log:latest
docker tag job.log ferrumgate/job.log:"$version"

execute() {
    docker push registry.ferrumgate.zero/ferrumgate/job.log:"$version"
    docker push registry.ferrumgate.zero/ferrumgate/job.log:latest
    if [ "$first" == "--push" ] || [ "$second" == "--push" ]; then
        docker push ferrumgate/job.log:"$version"
    fi

}

if [ "$first" == "--force" ] || [ "$second" == "--force" ]; then
    execute
    exit
else
    while true; do
        read -r -p "do you want push to local registry y/n " yn
        case $yn in
        [Yy]*)
            execute
            break
            ;;
        [Nn]*) exit ;;
        *) echo "please answer yes or no." ;;
        esac
    done
fi
