terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# SSH鍵ペア
resource "aws_lightsail_key_pair" "bot" {
  name       = var.ssh_key_name
  public_key = var.ssh_public_key
}

# Lightsail インスタンス
resource "aws_lightsail_instance" "bot" {
  name              = var.instance_name
  availability_zone = "${var.aws_region}a"
  blueprint_id      = "amazon_linux_2023"
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.bot.name

  user_data = templatefile("${path.module}/user_data.sh", {
    discord_token     = var.discord_token
    discord_client_id = var.discord_client_id
    guild_id          = var.guild_id
    node_env          = "production"
    port              = "3000"
  })

  tags = {
    Project = "moorestech-discord-bot"
  }
}

# ポート設定（SSHのみ）
resource "aws_lightsail_instance_public_ports" "bot" {
  instance_name = aws_lightsail_instance.bot.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
  }
}

# 固定IP
resource "aws_lightsail_static_ip" "bot" {
  name = "${var.instance_name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "bot" {
  static_ip_name = aws_lightsail_static_ip.bot.name
  instance_name  = aws_lightsail_instance.bot.name
}
