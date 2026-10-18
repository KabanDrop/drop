@echo off
chcp 65001 >nul
title KabanDrop - local server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_server.ps1"
