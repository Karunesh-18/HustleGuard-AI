# Docker Setup Guide - HustleGuard-AI

This guide explains how to run the HustleGuard-AI project using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (version 2.0+)

## Quick Start

### 1. Clone and Navigate to Project
```bash
cd w:\CODE\HustleGuard-AI
```

### 2. Configure Environment (Optional)
The project includes a `.env.docker` file with default development settings. To customize:

```bash
# Copy and edit if needed
copy .env.docker .env.local
```

### 3. Start All Services
```bash
docker-compose up -d
```

This command will:
- Create and start a PostgreSQL database
- Build and start the FastAPI backend
- Build and start the Next.js frontend
- Set up networking between services

### 4. Verify Services
```bash
# Check running containers
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Common Commands

### Stop Services
```bash
docker-compose stop
```

### Stop and Remove Containers
```bash
docker-compose down
```

### Stop and Remove Everything (including data)
```bash
docker-compose down -v
```

### Rebuild Images
```bash
docker-compose build --no-cache
```

### View Service Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Execute Commands in Container
```bash
# Run a command in backend container
docker-compose exec backend python -m pytest

# Access PostgreSQL CLI
docker-compose exec postgres psql -U hustleguard -d hustleguard_db
```

## Environment Variables

Edit `.env.docker` to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | hustleguard | PostgreSQL username |
| `DB_PASSWORD` | hustleguard_dev_password | PostgreSQL password |
| `DB_NAME` | hustleguard_db | Database name |
| `DB_PORT` | 5432 | PostgreSQL port |
| `BACKEND_PORT` | 8000 | Backend service port |
| `FRONTEND_PORT` | 3000 | Frontend service port |
| `ENVIRONMENT` | development | Environment mode |
| `LOG_LEVEL` | INFO | Logging level |
| `NODE_ENV` | development | Node environment |
| `NEXT_PUBLIC_API_URL` | http://localhost:8000 | Backend URL for frontend |

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild the image
docker-compose build --no-cache backend

# Restart service
docker-compose restart backend
```

### Database Connection Issues
```bash
# Verify database is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up postgres -d
```

### Frontend Not Loading
```bash
# Check if port 3000 is available
docker-compose logs frontend

# Rebuild frontend
docker-compose build --no-cache frontend

# Clear Next.js cache
docker-compose exec frontend rm -rf .next
```

### Port Already in Use
If port 3000 or 8000 is already in use, edit `.env.docker`:
```
FRONTEND_PORT=3001
BACKEND_PORT=8001
```

## Development Workflow

### Making Code Changes
The containers use volume mounts for development:

- **Backend**: Changes in `./backend` are automatically reflected (with hot-reload)
- **Frontend**: Changes in `./frontend` are automatically reflected (with hot-reload)
- **Database**: Data persists in the `postgres_data` volume

### Installing New Dependencies

#### Backend
```bash
# Edit requirements.txt, then rebuild
docker-compose build --no-cache backend
docker-compose up -d backend
```

#### Frontend
```bash
# Edit package.json, then rebuild
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Production Deployment

For production, consider:

1. Remove volume mounts for code directories
2. Set `NODE_ENV=production` and `ENVIRONMENT=production`
3. Use environment-specific `.env` files
4. Disable development features (like `--reload` for Uvicorn)
5. Use a reverse proxy (nginx) in front
6. Configure proper secrets management
7. Set up monitoring and logging

Example production compose adjustments:
```yaml
backend:
  command: uvicorn main:app --host 0.0.0.0 --port 8000
  # Remove: volumes, command override for reload

frontend:
  command: npm start
  # Remove: volumes, npm run dev
  environment:
    NODE_ENV: production
```

## Useful Docker Commands

```bash
# List all images
docker image ls

# Remove unused images
docker image prune

# Inspect a container
docker-compose inspect backend

# Get container IP
docker-compose exec backend hostname -I

# Copy files from container
docker-compose cp backend:/app/file.txt ./file.txt
```

## Further Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
