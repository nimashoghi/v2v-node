#!/bin/bash
yarn concurrently "ts-node ./src/index.ts ./experiment/triangular/0-0/.env" "ts-node ./src/index.ts ./experiment/triangular/1-0/.env" "ts-node ./src/index.ts ./experiment/triangular/2-0/.env" "ts-node ./src/index.ts ./experiment/triangular/3-0/.env" "ts-node ./src/index.ts ./experiment/triangular/0-1/.env" "ts-node ./src/index.ts ./experiment/triangular/1-1/.env" "ts-node ./src/index.ts ./experiment/triangular/2-1/.env" "ts-node ./src/index.ts ./experiment/triangular/0-2/.env" "ts-node ./src/index.ts ./experiment/triangular/1-2/.env" "ts-node ./src/index.ts ./experiment/triangular/2-2/.env" "ts-node ./src/index.ts ./experiment/triangular/3-2/.env" "ts-node ./src/index.ts ./experiment/triangular/0-3/.env" "ts-node ./src/index.ts ./experiment/triangular/1-3/.env" "ts-node ./src/index.ts ./experiment/triangular/2-3/.env" "ts-node ./src/index.ts ./experiment/triangular/0-4/.env" "ts-node ./src/index.ts ./experiment/triangular/1-4/.env" "ts-node ./src/index.ts ./experiment/triangular/2-4/.env" "ts-node ./src/index.ts ./experiment/triangular/3-4/.env" "ts-node ./src/index.ts ./experiment/triangular/0-5/.env" "ts-node ./src/index.ts ./experiment/triangular/1-5/.env" "ts-node ./src/index.ts ./experiment/triangular/2-5/.env"
