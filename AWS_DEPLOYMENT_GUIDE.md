# AWS EC2 Deployment Guide - FatSecret API

## Prerequisites

Before deploying, ensure you have:
- ✅ AWS EC2 instance running (you have: `54.193.177.163`)
- ✅ SSH key (.pem file) for your EC2 instance
- ✅ Security group allows inbound traffic on port 80 or 3000
- ✅ Your local `.env` file with FatSecret credentials

---

## Option 1: Deploy Using SCP (Recommended for Updates)

### Step 1: Prepare Your Local Files

First, make sure your code is ready:

```bash
# Navigate to project directory
cd "/Users/yash/Desktop/d&d healthcare/fatsecret"

# Commit your changes
git add .
git commit -m "Add recipe APIs and update configuration"

# Verify everything is working locally
npm start
# Test: http://localhost:3000/health
```

### Step 2: Connect to EC2 via SSH

```bash
# Replace with your actual key file path
ssh -i ~/path/to/your-key.pem ec2-user@54.193.177.163

# Or if using Ubuntu:
ssh -i ~/path/to/your-key.pem ubuntu@54.193.177.163
```

### Step 3: Upload Files to EC2

**Option A: Using SCP (from your local machine)**

```bash
# Upload entire project (excluding node_modules)
scp -i ~/path/to/your-key.pem -r \
  fatsecret.js \
  server.js \
  package.json \
  package-lock.json \
  README.md \
  ENV.EXAMPLE \
  FatSecret-API.postman_collection.json \
  ec2-user@54.193.177.163:~/fatsecret/

# Upload your .env file separately (contains secrets)
scp -i ~/path/to/your-key.pem .env ec2-user@54.193.177.163:~/fatsecret/
```

**Option B: Using rsync (faster for updates)**

```bash
rsync -avz -e "ssh -i ~/path/to/your-key.pem" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  ./ ec2-user@54.193.177.163:~/fatsecret/
```

### Step 4: Set Up on EC2

SSH into your EC2 instance:

```bash
ssh -i ~/path/to/your-key.pem ec2-user@54.193.177.163
```

Then run these commands on EC2:

```bash
# Navigate to project directory
cd ~/fatsecret

# Install/update dependencies
npm install

# Verify .env file exists and has correct values
cat .env

# If .env doesn't exist, create it:
nano .env
# Paste your credentials:
# FATSECRET_CLIENT_ID=your_client_id
# FATSECRET_CLIENT_SECRET=your_client_secret
# PORT=3000
# Save: Ctrl+O, Enter, Ctrl+X
```

### Step 5: Install PM2 (Process Manager)

PM2 keeps your app running even after you disconnect from SSH:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application
pm2 start server.js --name "fatsecret-api"

# Save PM2 configuration
pm2 save

# Set PM2 to start on system reboot
pm2 startup
# Follow the command it gives you (usually starts with sudo)
```

### Step 6: Verify Deployment

Test your API endpoints:

```bash
# From EC2 instance:
curl http://localhost:3000/health
curl "http://localhost:3000/recipes/search?search=pasta&limit=5"
curl "http://localhost:3000/recipes/trending?limit=5"

# From your local machine:
curl http://54.193.177.163:3000/health
curl "http://54.193.177.163:3000/recipes/search?search=pasta&limit=5"
```

---

## Option 2: Deploy Using Git (Recommended for Initial Setup)

### Step 1: Push Code to GitHub

```bash
# From your local machine
cd "/Users/yash/Desktop/d&d healthcare/fatsecret"

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit with recipe APIs"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/fatsecret-api.git
git branch -M main
git push -u origin main
```

### Step 2: Clone on EC2

```bash
# SSH into EC2
ssh -i ~/path/to/your-key.pem ec2-user@54.193.177.163

# Clone your repository
cd ~
git clone https://github.com/yourusername/fatsecret-api.git fatsecret
cd fatsecret

# Install dependencies
npm install

# Create .env file
nano .env
# Add your credentials
# Save: Ctrl+O, Enter, Ctrl+X

# Start with PM2
pm2 start server.js --name "fatsecret-api"
pm2 save
pm2 startup
```

### Step 3: For Future Updates

```bash
# SSH into EC2
ssh -i ~/path/to/your-key.pem ec2-user@54.193.177.163

# Navigate to project
cd ~/fatsecret

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Restart the application
pm2 restart fatsecret-api
```

---

## PM2 Commands (Useful for Management)

```bash
# View running processes
pm2 list

# View logs
pm2 logs fatsecret-api

# View real-time logs
pm2 logs fatsecret-api --lines 50

# Restart application
pm2 restart fatsecret-api

# Stop application
pm2 stop fatsecret-api

# Delete from PM2
pm2 delete fatsecret-api

# Monitor resource usage
pm2 monit
```

---

## Configure Nginx (Optional - For Port 80)

If you want your API accessible on port 80 (http://54.193.177.163/ instead of http://54.193.177.163:3000/):

### Step 1: Install Nginx

```bash
# On Amazon Linux:
sudo yum install nginx -y

# On Ubuntu:
sudo apt update
sudo apt install nginx -y
```

### Step 2: Configure Nginx

```bash
# Edit Nginx configuration
sudo nano /etc/nginx/conf.d/fatsecret.conf
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name 54.193.177.163;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 3: Start Nginx

```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx

# Enable on boot
sudo systemctl enable nginx

# Restart Nginx
sudo systemctl restart nginx
```

Now your API will be available at: `http://54.193.177.163/` (without port 3000)

---

## Security Group Configuration

Ensure your AWS Security Group allows inbound traffic:

1. Go to AWS Console → EC2 → Security Groups
2. Select your instance's security group
3. Add inbound rules:

| Type | Protocol | Port Range | Source |
|------|----------|------------|--------|
| HTTP | TCP | 80 | 0.0.0.0/0 |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 |
| SSH | TCP | 22 | Your IP |

---

## Environment Variables Setup

### Option 1: Manual .env file

```bash
# On EC2
cd ~/fatsecret
nano .env
```

Add:
```
FATSECRET_CLIENT_ID=your_actual_client_id
FATSECRET_CLIENT_SECRET=your_actual_client_secret
PORT=3000
```

### Option 2: Using PM2 Ecosystem File

```bash
# Create ecosystem.config.js
nano ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [{
    name: 'fatsecret-api',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      FATSECRET_CLIENT_ID: 'your_client_id',
      FATSECRET_CLIENT_SECRET: 'your_client_secret'
    }
  }]
}
```

Start with:
```bash
pm2 start ecosystem.config.js
```

---

## Testing After Deployment

### 1. Update Postman Collection

Update the `base_url` variable in your Postman collection:
- If using Nginx: `http://54.193.177.163`
- If using direct Node: `http://54.193.177.163:3000`

### 2. Test All Endpoints

Run these tests in Postman:
1. ✅ Health Check
2. ✅ Search Foods
3. ✅ Get Food by ID
4. ✅ Search Recipes
5. ✅ Get Trending Recipes
6. ✅ Get Recipe by ID

### 3. Command Line Tests

```bash
# From your local machine
curl http://54.193.177.163:3000/health
curl "http://54.193.177.163:3000/recipes/search?search=pasta&limit=3"
curl "http://54.193.177.163:3000/recipes/trending?limit=3"
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs fatsecret-api --lines 100

# Check if port is in use
sudo lsof -i :3000

# Check if Node.js is installed
node --version

# Restart PM2
pm2 restart fatsecret-api
```

### Cannot Connect from Outside

```bash
# Check if app is listening
curl http://localhost:3000/health

# Check firewall (Amazon Linux)
sudo iptables -L

# Check Security Group in AWS Console
# Ensure port 3000 (or 80) is open
```

### Environment Variables Not Loading

```bash
# Check .env file exists
ls -la ~/fatsecret/.env

# Check file contents (be careful, contains secrets!)
cat ~/fatsecret/.env

# Restart PM2 after .env changes
pm2 restart fatsecret-api
```

### Out of Memory

```bash
# Check memory usage
free -h

# Increase Node.js memory limit
pm2 delete fatsecret-api
pm2 start server.js --name fatsecret-api --max-memory-restart 500M
```

---

## Quick Deploy Script

Create a deployment script for easy updates:

```bash
# On your local machine
nano deploy.sh
```

Add:
```bash
#!/bin/bash

# Configuration
KEY_FILE="~/path/to/your-key.pem"
EC2_USER="ec2-user"
EC2_HOST="54.193.177.163"
REMOTE_DIR="~/fatsecret"

echo "🚀 Deploying to AWS EC2..."

# Upload files
rsync -avz -e "ssh -i $KEY_FILE" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  ./ $EC2_USER@$EC2_HOST:$REMOTE_DIR/

# Run remote commands
ssh -i $KEY_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'
cd ~/fatsecret
npm install
pm2 restart fatsecret-api
pm2 logs fatsecret-api --lines 20
ENDSSH

echo "✅ Deployment complete!"
echo "🌐 API available at: http://$EC2_HOST:3000"
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run it:
```bash
./deploy.sh
```

---

## Summary Checklist

- [ ] SSH key file ready
- [ ] Code committed locally
- [ ] .env file prepared with credentials
- [ ] Connected to EC2 via SSH
- [ ] Files uploaded to EC2
- [ ] Dependencies installed (`npm install`)
- [ ] PM2 installed and configured
- [ ] Application started with PM2
- [ ] Security group ports open (3000 or 80)
- [ ] Tested all endpoints
- [ ] Updated Postman collection base_url
- [ ] PM2 startup configured for auto-restart

---

## Need Help?

If you encounter issues:
1. Check PM2 logs: `pm2 logs fatsecret-api`
2. Verify EC2 security group settings
3. Ensure .env file has correct credentials
4. Test locally first: `curl http://localhost:3000/health`
5. Check if port is accessible: `telnet 54.193.177.163 3000`

Good luck with your deployment! 🚀

