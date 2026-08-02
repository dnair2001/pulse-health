.PHONY: install install-backend install-frontend dev backend frontend test test-backend test-frontend build clean

install: install-backend install-frontend

install-backend:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

install-frontend:
	cd frontend && npm install

# Run in two terminals: `make backend` and `make frontend`
dev:
	@echo "Run 'make backend' in one terminal and 'make frontend' in another."

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm start

test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/pytest

test-frontend:
	cd frontend && npm test -- --watch=false

build:
	cd frontend && npm run build

clean:
	rm -rf frontend/node_modules frontend/dist frontend/.angular backend/.venv
	find backend -name __pycache__ -type d -prune -exec rm -rf {} +
