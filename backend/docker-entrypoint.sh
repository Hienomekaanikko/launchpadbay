#!/bin/sh
set -e

# Belt-and-suspenders for the mysql healthcheck in docker-compose.yml: on a
# slow/loaded machine (e.g. a school lab PC) MySQL can still not be fully
# ready the instant the healthcheck flips green, or this image can be run
# standalone without compose's depends_on at all. Retry indefinitely instead
# of letting one failed migrate attempt kill the container.
until ./node_modules/.bin/prisma migrate deploy; do
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
done

./node_modules/.bin/prisma db seed
exec node server.js
