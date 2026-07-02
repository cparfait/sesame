#!/bin/sh
set -e

echo "Sésame — application des migrations…"
node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

echo "Sésame — démarrage du serveur…"
exec node server.js
