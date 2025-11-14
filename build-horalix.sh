#!/bin/bash
echo "Building Horalix Halo..."
echo "Skipping type check (external deps missing types)..."
npx tsc -p electron/tsconfig.json --noEmit false || true
echo "Starting Electron..."
NODE_ENV=development electron electron/horalix-main.js
