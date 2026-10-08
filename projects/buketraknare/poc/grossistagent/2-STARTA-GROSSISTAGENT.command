#!/bin/bash
cd "$(dirname "$0")" || exit 1
wait_key() { echo; read -n 1 -s -r -p "Tryck på en tangent för att stänga det här fönstret..."; echo; }
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js saknas på den här datorn."
  echo "Installera det från https://nodejs.org (välj LTS), starta om datorn och dubbelklicka igen."
  wait_key; exit 1
fi
if [ ! -d node_modules/playwright-core ]; then
  echo
  echo "Dubbelklicka först på 1-SETUP (görs bara en gång)."
  wait_key; exit 1
fi
node src/launcher.mjs start
wait_key
