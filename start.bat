@echo off
cd /d %~dp0
npm run start >> logs.txt 2>&1
