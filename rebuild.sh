#!/bin/bash

cd chillfi3
# Stop and remove all containers
docker-compose down
# Remove all Docker volumes (database and Redis data)
docker volume rm chillfi3_db_data chillfi3_redis_data
# Remove Docker images
docker rmi chillfi3_app
# Clean up any Docker networks
docker network prune -f
cd ..
sudo rm -rf chillfi3
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3
chmod +x install-docker.sh
./install-docker.sh



