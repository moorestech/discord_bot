#!/bin/bash
set -euo pipefail

# Node.js 22 インストール
dnf install -y nodejs22 nodejs22-npm || {
  # パッケージが見つからない場合は NodeSource を使用
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  dnf install -y nodejs
}

# アプリユーザー作成（npmキャッシュ用にホームディレクトリも作成）
useradd --system --create-home --shell /usr/sbin/nologin discord-bot

# ディレクトリ作成
mkdir -p /opt/discord-bot
mkdir -p /etc/discord-bot
chown discord-bot:discord-bot /opt/discord-bot

# 環境変数ファイル
cat > /etc/discord-bot/.env << 'ENVEOF'
NODE_ENV=${node_env}
DISCORD_TOKEN=${discord_token}
DISCORD_CLIENT_ID=${discord_client_id}
GUILD_ID=${guild_id}
PORT=${port}
ENVEOF
chmod 600 /etc/discord-bot/.env
chown discord-bot:discord-bot /etc/discord-bot/.env

# systemd サービス
cat > /etc/systemd/system/discord-bot.service << 'SERVICEEOF'
[Unit]
Description=moorestech Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=discord-bot
Group=discord-bot
WorkingDirectory=/opt/discord-bot
EnvironmentFile=/etc/discord-bot/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable discord-bot.service
