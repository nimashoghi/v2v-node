#!/bin/bash

yarn install && yarn build:scratch
docker build -t nimashoghi/dac-v2v .
