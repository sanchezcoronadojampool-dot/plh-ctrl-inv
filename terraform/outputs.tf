output "instance_name" {
  description = "Nombre de la nueva VM."
  value       = google_compute_instance.app.name
}

output "external_ip" {
  description = "IP externa efímera de la VM; puede cambiar al detenerla."
  value       = google_compute_instance.app.network_interface[0].access_config[0].nat_ip
}

output "ssh_command" {
  description = "Comando SSH de ejemplo para conectar desde una terminal."
  value       = "ssh ${var.ssh_username}@${google_compute_instance.app.network_interface[0].access_config[0].nat_ip}"
}
