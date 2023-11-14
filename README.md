## Build
docker build -t cosmicshuffle .


## Run
docker run --rm -ti -p 8888:8888 cosmicshuffle

> This will start the Node.js app in a container and bind the container's 8888 port to the host machine's 8888 port, so you can access the app from your host machine at http://localhost:8888.