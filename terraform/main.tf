terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_compute_firewall" "web" {
  name      = "${var.instance_name}-web"
  network   = var.network
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.instance_name}-web"]
}

resource "google_compute_firewall" "ssh" {
  name      = "${var.instance_name}-ssh"
  network   = var.network
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [var.ssh_source_cidr]
  target_tags   = ["${var.instance_name}-web"]
}

resource "google_compute_instance" "app" {
  name                      = var.instance_name
  zone                      = var.zone
  machine_type              = var.machine_type
  tags                      = ["${var.instance_name}-web"]
  allow_stopping_for_update = true
  deletion_protection       = true

  boot_disk {
    auto_delete = true

    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64"
      size  = var.boot_disk_size_gb
      type  = "pd-standard"
    }
  }

  network_interface {
    network = var.network

    access_config {}
  }

  metadata = {
    block-project-ssh-keys = "TRUE"
    ssh-keys                = "${var.ssh_username}:${trimspace(var.ssh_public_key)}"
  }

  metadata_startup_script = file("${path.module}/startup.sh")

  labels = {
    app         = "plh-inventory"
    environment = "production"
  }
}
