#!/bin/bash

docker-compose down --volumes --remove-orphans
docker-compose up -d
docker attach v2v-client_client_1
