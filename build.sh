#!/bin/bash

docker buildx build --platform linux/arm,linux/arm64,linux/amd64 -t nimashoghi/v2v-node . --push
