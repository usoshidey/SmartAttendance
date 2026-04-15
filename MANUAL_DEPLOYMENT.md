# Smart Attendance System - Production Deployment Guide
# Execute these commands in your own terminal (with proper terminal support)

## Deployment Configuration
```
Target Server:  10.29.8.13
SSH User:       user10
SSH Password:   glrrNH9Ud4UhIye4
SSH Port:       22
Remote Path:    /home/user10/SmartAttendanceSystem

Ports:
  - Frontend:   6004
  - Backend:    6005
  - Database:   6006
```

## Step 1: SSH into Server and Prepare Directories
Run this in your terminal (copy-paste the entire block):

```bash
ssh -p 22 user10@10.29.8.13 << 'EOF'
set -e
REMOTE_PATH="/home/user10/SmartAttendanceSystem"

echo "Creating directories..."
mkdir -p $REMOTE_PATH/data/{uploads,faces,faces_filtered,embeddings,clusters,registered_embeddings,attendance_reports}
mkdir -p $REMOTE_PATH/models

echo "Creating .env file..."
cat > $REMOTE_PATH/.env << 'ENVEOF'
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql://sa_user:sa_password@db:5432/smart_attendance
SECRET_KEY=$(openssl rand -hex 32)
SMTP_EMAIL=
SMTP_PASSWORD=
ENVEOF

echo "✓ Server prepared"
echo "  Remote path: $REMOTE_PATH"
ls -la $REMOTE_PATH/ | head -5
EOFc
```

When prompted for password, enter: `glrrNH9Ud4UhIye4`

## Step 2: Copy Project Files from Local Machine
Navigate to your local `SmartAttendanceSystem` directory and run:

```bash
# From local machine in the SmartAttendanceSystem directory:
scp -P 22 -r docker-compose.yml Dockerfile.backend requirements.txt backend frontend models user10@10.29.8.13:/home/user10/SmartAttendanceSystem/

# When prompted for password, enter: glrrNH9Ud4UhIye4
```

## Step 3: Start All Services
Run this in your terminal:

```bash
ssh -p 22 user10@10.29.8.13 << 'EOF'
set -e
REMOTE_PATH="/home/user10/SmartAttendanceSystem"
cd $REMOTE_PATH

echo "═══════════════════════════════════════════════════════════"
echo "Starting Smart Attendance System"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "[1/3] Pulling latest Docker images from Docker Hub..."
docker-compose pull

echo ""
echo "[2/3] Starting services with docker-compose..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose up -d

echo ""
echo "[3/3] Waiting for services to initialize (20 seconds)..."
sleep 20

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Service Status:"
echo "═══════════════════════════════════════════════════════════"
docker-compose ps

echo ""
echo "Testing services..."
echo "  API Health Check:"
curl -s http://localhost:6005/health | python3 -m json.tool || echo "  Still initializing..."

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Access your application:"
echo "  Frontend:    http://10.29.8.13:6004"
echo "  Backend API: http://10.29.8.13:6005"
echo "  API Docs:    http://10.29.8.13:6005/docs"
echo "  Database:    postgresql://10.29.8.13:6006"
echo ""
EOF
```

When prompted for password, enter: `glrrNH9Ud4UhIye4`

## Post-Deployment Verification

### Test Frontend
Open in browser: http://10.29.8.13:6004

### Test Backend API
```bash
curl http://10.29.8.13:6005/health
# Expected response: {"status":"ok","service":"Smart Attendance API"}
```

### Test Database Connection (from local machine with psql installed)
```bash
psql -h 10.29.8.13 -p 6006 -U sa_user -d smart_attendance
# Password: sa_password

# Once connected, run:
\dt  # List all tables
\q   # Quit
```

### View Service Logs
```bash
# All logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs -f'

# Specific service logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs -f backend'
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs -f frontend'
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs -f db'
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs -f worker'
```

### Check Service Status
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose ps'
```

### Stop Services
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose down'
```

### Restart Services
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose restart'
```

## Information About Your Setup

### GitHub Actions CI/CD (Automatic)
- **How it works**: When you push to the `main` branch, GitHub Actions automatically:
  1. Reads `.github/workflows/docker-build-push.yml`
  2. Builds Docker images for backend and frontend
  3. Pushes images to Docker Hub under `usoshidey` account
  4. Backend image: `usoshidey/smart-attendance-backend:latest`
  5. Frontend image: `usoshidey/smart-attendance-frontend:latest`

- **What to do**: Just push your code to GitHub!
  ```bash
  git add .
  git commit -m "Your changes"
  git push origin main
  ```

### Watchtower Auto-Update (Running on Server)
- **How it works**: 
  - Service `watchtower` is running in docker-compose.yml
  - Every 5 minutes it checks Docker Hub for new images
  - If new images are found, it automatically pulls and restarts containers
  - No manual intervention needed!

- **Status**:
  ```bash
  ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs watchtower'
  ```

## Database Details

### Connection from External Machine (Your Laptop)
```
Host:     10.29.8.13
Port:     6006
User:     sa_user
Password: sa_password
Database: smart_attendance
```

### Connection String (Python)
```python
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://sa_user:sa_password@10.29.8.13:6006/smart_attendance"
engine = create_engine(DATABASE_URL)
```

### Connection String (psql CLI)
```bash
psql -h 10.29.8.13 -p 6006 -U sa_user -d smart_attendance
```

## Services Running on 10.29.8.13

| Service | Container | Port (Internal) | Port (External) | Status |
|---------|-----------|-----------------|-----------------|--------|
| Frontend | `frontend` | 80 | 6004 | Running |
| Backend API | `backend` | 6005 | 6005 | Running |
| PostgreSQL | `db` | 5432 | 6006 | Running |
| Redis | `redis` | 6379 | - | Running (internal only) |
| Celery Worker | `worker` | - | - | Running (internal) |
| Watchtower | `watchtower` | - | - | Running (auto-updates) |

## Deployment Checklist

- [ ] Step 1: SSH and prepare directories
- [ ] Step 2: Copy project files via SCP
- [ ] Step 3: Start services with docker-compose
- [ ] Verify: Frontend loads at http://10.29.8.13:6004
- [ ] Verify: API docs at http://10.29.8.13:6005/docs
- [ ] Verify: Database connection works
- [ ] Test: Create a subject and register students
- [ ] Test: Upload a test video for attendance marking

## Quick Troubleshooting

### Services won't start
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs'
```

### Database connection fails
```bash
# Check if DB container is running
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose ps db'

# Restart DB
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose restart db'
```

### API not responding
```bash
# Check backend logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs backend | tail -50'

# Restart backend
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose restart backend'
```

### Watchtower not updating
```bash
# Check watchtower logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose logs watchtower'

# Manually trigger update
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker-compose pull && docker-compose restart'
```

## Next Steps After Deployment

1. **Wait 2-3 minutes** for all services to fully initialize
2. **Test the Frontend**: http://10.29.8.13:6004
3. **Check API Docs**: http://10.29.8.13:6005/docs
4. **Create an admin account** via frontend
5. **Test the workflow**:
   - Create a subject
   - Register students with videos
   - Mark attendance
   - Download reports

## For Future Updates

1. Make your code changes locally
2. Git push to main: `git push origin main`
3. GitHub Actions automatically builds and pushes images
4. Watchtower automatically updates the server (within 5 minutes)
5. No manual deployment needed!

---

**Deployment Ready! ✅**
Execute the 3 steps above to deploy your application.

echo " " >> MANUAL_DEPLOYMENT.md
