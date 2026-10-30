# One-command control of the local website (Windows: needs GNU make and PowerShell).
# The work is done by scripts/site.ps1; see README.md section 2.

SITE := powershell -NoProfile -ExecutionPolicy Bypass -File scripts/site.ps1

.DEFAULT_GOAL := help
.PHONY: help install up down restart status

help:
	@echo make install   - once: Python environment and frontend packages
	@echo make up        - start the backend and the frontend, open the website
	@echo make down      - stop both
	@echo make restart   - down, then up
	@echo make status    - show what is running

install:
	@$(SITE) install

up:
	@$(SITE) up

down:
	@$(SITE) down

restart: down up

status:
	@$(SITE) status
