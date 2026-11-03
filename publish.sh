#!/bin/sh
set -e; cd "$(dirname "$0")"; python3 build.py
rm -rf c s w assets index.html; cp -r site/. ./
