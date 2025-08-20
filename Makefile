.PHONY: dev-frontend dev-backend build-frontend build-backend up down logs

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && mvn spring-boot:run

build-frontend:
	cd frontend && (npm ci || npm install) && npm run build

build-backend:
	cd backend && mvn -DskipTests package

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200
