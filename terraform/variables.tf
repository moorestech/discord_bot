variable "aws_region" {
  description = "AWS region for Lightsail"
  type        = string
  default     = "ap-northeast-1"
}

variable "instance_name" {
  description = "Lightsail instance name"
  type        = string
  default     = "moorestech-discord-bot"
}

variable "bundle_id" {
  description = "Lightsail instance bundle (nano_3_0 = $5/month, 512MB RAM, 2 vCPU)"
  type        = string
  default     = "nano_3_0"
}

variable "ssh_key_name" {
  description = "Name of the Lightsail key pair"
  type        = string
  default     = "discord-bot-key"
}

variable "ssh_public_key" {
  description = "SSH public key content"
  type        = string
}

variable "discord_token" {
  description = "Discord bot token"
  type        = string
  sensitive   = true
}

variable "discord_client_id" {
  description = "Discord application client ID"
  type        = string
}

variable "guild_id" {
  description = "Guild ID for guild-specific command registration"
  type        = string
  default     = ""
}
