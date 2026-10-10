variable "project_id" {
  description = "ID del proyecto de Google Cloud donde se creará la VM."
  type        = string
}

variable "region" {
  description = "Región de Google Cloud."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona de Compute Engine dentro de la región elegida."
  type        = string
  default     = "us-central1-a"
}

variable "network" {
  description = "Nombre de la red VPC existente."
  type        = string
  default     = "default"
}

variable "instance_name" {
  description = "Nombre de la VM y prefijo de sus reglas de firewall."
  type        = string
  default     = "plh-inventario"
}

variable "machine_type" {
  description = "Tipo de máquina; e2-medium ofrece 4 GB y margen para compilar y ejecutar la aplicación."
  type        = string
  default     = "e2-medium"
}

variable "boot_disk_size_gb" {
  description = "Tamaño del disco persistente estándar en GB."
  type        = number
  default     = 30

  validation {
    condition     = var.boot_disk_size_gb >= 20
    error_message = "Usa al menos 20 GB para Ubuntu, Docker, las imágenes y los datos."
  }
}

variable "ssh_username" {
  description = "Usuario Linux que corresponde a la clave pública SSH."
  type        = string

  validation {
    condition     = can(regex("^[a-z_][a-z0-9_-]{0,31}$", var.ssh_username))
    error_message = "El usuario SSH debe usar letras minúsculas, números, guion o guion bajo."
  }
}

variable "ssh_public_key" {
  description = "Clave pública SSH en formato OpenSSH; nunca introduzcas aquí la clave privada."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) ", trimspace(var.ssh_public_key)))
    error_message = "Proporciona una clave pública OpenSSH válida exportada desde PuTTYgen."
  }
}

variable "ssh_source_cidr" {
  description = "Tu IP pública con máscara /32; solo esa dirección podrá acceder por SSH."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.ssh_source_cidr))
    error_message = "Usa tu IP pública seguida de /32, por ejemplo 203.0.113.10/32."
  }
}
