# job.log

system log parsing and saving

## getting started

## compiling

job.log project use lots of code from rest.portal project.
follow below steps,
VERSION=$(read package.json and from dependencies section, rest.portal related version)

download, compile and npm link

```**sh**
    git clone git@gitlab.com:ferrumgate/rest.portal.git
    cd rest.portal
    git checkout $VERSION
    npm install && npm run build
    cd build/src
    npm link .
    
```

```**sh**
    cd job.log
    npm link rest.portal@${VERSION} --save
    npm run build
```
