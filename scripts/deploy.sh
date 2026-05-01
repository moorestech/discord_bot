#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
TERRAFORM_DIR="$REPO_ROOT/terraform"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/discord-bot-key}"
SSH_USER="ec2-user"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"

# Terraform output からインスタンスIPを取得
INSTANCE_IP="${INSTANCE_IP:-$(cd "$TERRAFORM_DIR" && terraform output -raw public_ip)}"

echo "=== Building TypeScript ==="
cd "$REPO_ROOT"
npm run build

echo "=== Syncing files to $INSTANCE_IP ==="
ssh $SSH_OPTS "$SSH_USER@$INSTANCE_IP" "mkdir -p /tmp/discord-bot-deploy/dist"

rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  "$REPO_ROOT/dist/" \
  "$SSH_USER@$INSTANCE_IP:/tmp/discord-bot-deploy/dist/"

rsync -avz \
  -e "ssh $SSH_OPTS" \
  "$REPO_ROOT/package.json" \
  "$REPO_ROOT/package-lock.json" \
  "$SSH_USER@$INSTANCE_IP:/tmp/discord-bot-deploy/"

# YAML設定ファイルを転送
for yaml_file in "$REPO_ROOT"/*.yaml; do
  [ -f "$yaml_file" ] && rsync -avz \
    -e "ssh $SSH_OPTS" \
    "$yaml_file" \
    "$SSH_USER@$INSTANCE_IP:/tmp/discord-bot-deploy/"
done

echo "=== Deploying and restarting service ==="
ssh $SSH_OPTS "$SSH_USER@$INSTANCE_IP" << 'REMOTEOF'
  # ファイル配置（サービス停止前に実施）
  sudo rm -rf /opt/discord-bot/dist
  sudo cp -r /tmp/discord-bot-deploy/dist /opt/discord-bot/dist
  sudo cp /tmp/discord-bot-deploy/package.json /opt/discord-bot/
  sudo cp /tmp/discord-bot-deploy/package-lock.json /opt/discord-bot/
  # YAML設定ファイルをコピー
  for yaml_file in /tmp/discord-bot-deploy/*.yaml; do
    [ -f "$yaml_file" ] && sudo cp "$yaml_file" /opt/discord-bot/
  done
  sudo chown -R discord-bot:discord-bot /opt/discord-bot

  # package-lock.json が変わった場合のみ npm ci を実行
  cd /opt/discord-bot
  if [ ! -d node_modules ] || ! diff -q /tmp/discord-bot-deploy/package-lock.json /opt/discord-bot/.package-lock-installed 2>/dev/null; then
    echo "Dependencies changed, running npm ci..."
    sudo -u discord-bot npm ci --omit=dev
    sudo cp package-lock.json .package-lock-installed
  else
    echo "Dependencies unchanged, skipping npm ci"
  fi

  sudo systemctl restart discord-bot
  echo "=== Service status ==="
  sudo systemctl status discord-bot --no-pager
REMOTEOF

echo "=== Deploy complete ==="
