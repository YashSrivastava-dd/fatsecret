#!/bin/bash

# ===========================================
# FatSecret API - AWS EC2 Deployment Script
# ===========================================

# Configuration - UPDATE THESE VALUES!
KEY_FILE="$HOME/.ssh/your-ec2-key.pem"  # Change this to your actual .pem file path
EC2_USER="ec2-user"                      # Or "ubuntu" for Ubuntu instances
EC2_HOST="54.193.177.163"                # Your EC2 IP
REMOTE_DIR="~/fatsecret"                 # Directory on EC2

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment to AWS EC2...${NC}"

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Error: SSH key file not found at $KEY_FILE${NC}"
    echo "Please update KEY_FILE in this script with your actual .pem file path"
    exit 1
fi

# Check if .env exists locally
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found locally${NC}"
    echo "Make sure to create .env file on EC2 server manually"
fi

echo -e "${YELLOW}📦 Uploading files to EC2...${NC}"

# Upload files using rsync
rsync -avz -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude 'deploy.sh' \
  --exclude 'AWS_DEPLOYMENT_GUIDE.md' \
  ./ $EC2_USER@$EC2_HOST:$REMOTE_DIR/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to upload files${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files uploaded successfully${NC}"
echo -e "${YELLOW}🔧 Installing dependencies and restarting server...${NC}"

# Run commands on EC2
ssh -i $KEY_FILE -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST << 'ENDSSH'
cd ~/fatsecret

# Install dependencies
echo "Installing npm packages..."
npm install

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please create it with your FatSecret credentials"
    echo "Run: nano .env"
    echo "Add:"
    echo "FATSECRET_CLIENT_ID=your_client_id"
    echo "FATSECRET_CLIENT_SECRET=your_client_secret"
    echo "PORT=3000"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing PM2..."
    sudo npm install -g pm2
fi

# Check if app is already running
if pm2 list | grep -q "fatsecret-api"; then
    echo "Restarting existing application..."
    pm2 restart fatsecret-api
else
    echo "Starting new application..."
    pm2 start server.js --name "fatsecret-api"
    pm2 save
fi

# Show recent logs
echo ""
echo "=== Recent Logs ==="
pm2 logs fatsecret-api --lines 20 --nostream

# Show PM2 status
echo ""
echo "=== PM2 Status ==="
pm2 list
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo ""
    echo "🌐 Your API is available at:"
    echo "   http://$EC2_HOST:3000"
    echo ""
    echo "📝 Test your endpoints:"
    echo "   curl http://$EC2_HOST:3000/health"
    echo "   curl \"http://$EC2_HOST:3000/recipes/search?search=pasta&limit=5\""
    echo "   curl \"http://$EC2_HOST:3000/recipes/trending?limit=5\""
    echo ""
    echo "📊 View logs on EC2:"
    echo "   ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"
    echo "   pm2 logs fatsecret-api"
else
    echo -e "${RED}❌ Deployment failed. Check the error messages above.${NC}"
    exit 1
fi






