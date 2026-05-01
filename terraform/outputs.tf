output "instance_name" {
  description = "Lightsail instance name"
  value       = aws_lightsail_instance.bot.name
}

output "public_ip" {
  description = "Static public IP address"
  value       = aws_lightsail_static_ip.bot.ip_address
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/discord-bot-key ec2-user@${aws_lightsail_static_ip.bot.ip_address}"
}
