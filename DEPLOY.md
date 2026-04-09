# 🚀 Production Deployment Guide

**Your Setup**: GitHub Actions CI/CD + Docker Hub + Watchtower Auto-Update + 3-Service Architecture

---

## 📁 Project Structure (Reorganized)

```
SmartAttendanceSystem/
├── backend/                    # Backend service (Port 6005)
│   ├── Dockerfile             # Backend container build
│   ├── requirements.txt       # Python dependencies
│   └── [source code...]
├── frontend/                  # Frontend service (Port 6004)
│   ├── Dockerfile.frontend    # Frontend container build
│   └── [source code...]
├── docker-compose.yml         # Orchestrates all 3 services
└── data/                      # Shared data volumes
```

---

## 🔧 3-Service Architecture

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **Frontend** | 6004 | React + Nginx | User interface |
| **Backend** | 6005 | FastAPI + Python | API & business logic |
| **Database** | 6006 | PostgreSQL | Data persistence |
| **Redis** | Internal | Message broker | Task queue |

---

## 🚀 FINAL DEPLOYMENT PROCESS

### Step 1: Push Code to GitHub (Triggers CI/CD)
```bash
cd SmartAttendanceSystem
git add .
git commit -m "Reorganized project structure"
git push origin main
```

**✅ GitHub Actions will automatically:**
- Build `usoshidey/smart-attendance-backend:latest` from `backend/`
- Build `usoshidey/smart-attendance-frontend:latest` from `frontend/`
- Push both images to Docker Hub

### Step 2: Initial Server Setup (One Time)
```bash
# SSH into server
ssh user10@10.29.8.13

# Create project structure
mkdir -p /home/user10/SmartAttendanceSystem/data/{uploads,faces,faces_filtered,embeddings,clusters,registered_embeddings,attendance_reports}
mkdir -p /home/user10/SmartAttendanceSystem/models
cd /home/user10/SmartAttendanceSystem

# Create environment file
cat > .env << 'EOF'
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql://sa_user:sa_password@db:5432/smart_attendance
SECRET_KEY=secure-production-key-12345
SMTP_EMAIL=
SMTP_PASSWORD=
EOF
```

### Step 3: Deploy Services
```bash
# Exit SSH and copy docker-compose.yml
exit
cd C:\SmartAttandance\SmartAttendanceSystem
scp -P 22 docker-compose.yml user10@10.29.8.13:/home/user10/SmartAttendanceSystem/

# SSH back in and start services
ssh user10@10.29.8.13
cd /home/user10/SmartAttendanceSystem
docker compose pull  # Pull latest images from Docker Hub
docker compose up -d
sleep 30
docker compose ps
```

**✅ Your 3 services are now running!**

---

## 📤 FUTURE UPDATES (Fully Automated)

**Just push to GitHub:**
```bash
git push origin main
```

**Watchtower automatically deploys within 5 minutes!**

---

## 📤 GOING FORWARD (After Initial Setup)

### For Every Update:

**Step 1: Make changes locally**
```bash
# On your local machine
cd SmartAttendanceSystem
# ... make your code changes ...
```

**Step 2: Push to GitHub (main branch)**
```bash
git add .
git commit -m "Your changes description"
git push origin main
```

**✅ That's it!** Then:
- ✅ GitHub Actions automatically builds Docker images
- ✅ Images pushed to Docker Hub (`usoshidey/smart-attendance-backend:latest`, `usoshidey/smart-attendance-frontend:latest`)
- ✅ Watchtower on server automatically pulls & deploys (checks every 5 minutes)

---

## 🛠️ Manual Commands (If Needed)

### Check Service Status
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose ps'
```

### View Logs
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs -f backend'
```

### Force Update (Don't Wait for Watchtower)
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose pull && docker compose up -d'
```

### Restart Services
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose restart'
```

### Stop Services
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose down'
```

---

## ✅ VERIFICATION & TESTING

After deployment, verify all services are running:

### 1. Check Service Status
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose ps'
```

**Expected Output:**
- `backend` → Status: `Up (healthy)` on port 6005 ✓
- `frontend` → Status: `Up` on port 6004 ✓
- `db` → Status: `Up (healthy)` on port 6006 ✓
- `redis` → Status: `Up (healthy)` on port 6379 ✓
- `worker` → Status: `Up (health: starting / healthy)` ✓
- `watchtower` → Status: `Up` or `Restarting` (this is normal) ✓

### 2. Access the Frontend
Open browser and navigate to:
```
http://10.29.8.13:6004
```
You should see the login/registration page.

### 3. Test the API
Access FastAPI Swagger documentation:
```
http://10.29.8.13:6005/docs
```
You can test endpoints directly from Swagger UI.

### 4. Check Logs for Errors
```bash
# Backend logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs backend'

# Frontend logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs frontend'

# Worker logs
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs worker'
```

---

## 🔧 TROUBLESHOOTING

### Issue: Watchtower API Version Mismatch
**Cause:** Server's Docker daemon uses API v1.40+, but Watchtower uses v1.25  
**Solution:** Watchtower has been disabled in docker-compose.yml. For manual updates, run:
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose pull && docker compose up -d'
```
To re-enable Watchtower (if server updates Docker), uncomment it in docker-compose.yml

### Issue: Backend container not healthy
**Cause:** Database connection issues, missing dependencies, or startup delay  
**Solution:** Check backend logs:
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs backend'
```

### Issue: Frontend showing blank or connection refused
**Cause:** Backend not responding, incorrect port, or API call issues  
**Solution:** 
1. Verify backend is running: `curl http://10.29.8.13:6005/docs`
2. Check frontend logs: `docker compose logs frontend`
3. Check browser console for errors (Press F12)

### Issue: Worker service showing unhealthy
**Cause:** Health check using Celery inspect (now fixed)  
**Solution:** Already resolved in updated docker-compose.yml. Restart worker:
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose restart worker'
```
Check status:
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose ps worker'
```

### Issue: Port already in use
**Cause:** Old containers or services still running  
**Solution:**
```bash
# Remove all old containers
ssh user10@10.29.8.13 'docker rm -f $(docker ps -aq) 2>/dev/null; echo "Cleaned up"'

# Restart compose
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose up -d'
```

### Issue: Watchtower not auto-updating
**Cause:** Watchtower not monitoring the right images  
**Solution:** Check watchtower is running:
```bash
ssh user10@10.29.8.13 'cd /home/user10/SmartAttendanceSystem && docker compose logs watchtower'
```
It should check for updates every 5 minutes.

---

## 📊 System URLs (After Deployment)

| Service | URL |
|---------|-----|
| Frontend | http://10.29.8.13:6004 |
| Backend API | http://10.29.8.13:6005 |
| API Docs (Swagger) | http://10.29.8.13:6005/docs |
| Database | 10.29.8.13:6006 (PostgreSQL) |
| Redis | 10.29.8.13:6379 (Redis CLI) |

---

## ✅ Verification

Once deployed, test:

### Frontend
Open: **http://10.29.8.13:6004**

### Backend API Docs
Open: **http://10.29.8.13:6005/docs**

### Database Connection
```bash
psql -h 10.29.8.13 -p 6006 -U sa_user -d smart_attendance
# Password: sa_password
```

---

## 📋 Server Access Details

| Property | Value |
|----------|-------|
| **Host** | 10.29.8.13 |
| **SSH User** | user10 |
| **SSH Password** | glrrNH9Ud4UhIye4 |
| **SSH Port** | 22 |
| **Project Path** | /home/user10/SmartAttendanceSystem |

---

## 🔗 Service URLs & Ports

| Service | URL | Port |
|---------|-----|------|
| **Frontend** | http://10.29.8.13:6004 | 6004 |
| **Backend API** | http://10.29.8.13:6005 | 6005 |
| **API Docs** | http://10.29.8.13:6005/docs | 6005 |
| **Database** | postgresql://10.29.8.13:6006 | 6006 |
| **Redis** | redis://localhost:6379 | (Internal) |

---

## 📊 Database Credentials

```
Host:     10.29.8.13
Port:     6006
User:     sa_user
Password: sa_password
Database: smart_attendance
```

---

**That's it! 🎉 Your deployment is now fully automated!**
