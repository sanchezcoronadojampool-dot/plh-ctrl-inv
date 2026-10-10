# Crear la VM de Google Cloud con Terraform

El botón **Importar VM** de la pantalla de Compute Engine que aparece en la captura inicia la migración de una VM que ya existe fuera de Google Cloud; requiere importar su disco virtual. No sirve para crear una máquina nueva a partir de un archivo `.tf`. Como no tienes una VM que migrar, usa esta plantilla con Terraform para **crear una VM nueva**.

La VM usa Ubuntu 24.04, Docker, una IP externa efímera, un disco persistente estándar de 30 GB y una `e2-medium` (4 GB de memoria). No crea un balanceador de carga ni una IP estática. Solo habilita HTTP/HTTPS desde Internet y SSH desde la IP indicada.

## Antes de empezar

1. En Google Cloud Console, selecciona el proyecto correcto, confirma que la facturación esté habilitada y habilita **Compute Engine API**.
2. Abre Cloud Shell con el botón `>_` de la barra superior. Cloud Shell usa tu proyecto y tu cuenta activa de Google; autoriza el acceso si aparece una solicitud.
3. Instala Terraform en Cloud Shell desde el repositorio oficial de HashiCorp:

   ```sh
   sudo apt-get update
   sudo apt-get install -y ca-certificates gnupg
   curl -fsSL https://apt.releases.hashicorp.com/gpg \
     | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   sudo chmod 644 /usr/share/keyrings/hashicorp-archive-keyring.gpg
   . /etc/os-release
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com ${VERSION_CODENAME} main" \
     | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt-get update
   sudo apt-get install -y terraform
   ```

4. Consigue estos archivos en Cloud Shell después de publicarlos en el repositorio: clona el proyecto con Git si tienes acceso, o súbelos desde Cloud Shell Editor. No uses el botón **Importar VM** para estos archivos.
5. En PuTTYgen, crea o selecciona tu clave SSH. Conserva el archivo privado `.ppk` en tu computadora y copia la clave pública en formato OpenSSH. No copies la clave privada al proyecto ni a Terraform.
6. Averigua tu IP pública actual y añádele `/32` (por ejemplo, `203.0.113.10/32`). Esto limita el acceso SSH a tu conexión actual; si cambia tu IP, actualiza la regla y vuelve a aplicar Terraform.

## Crear la VM

Abre una terminal en la carpeta `terraform`:

```sh
cp terraform.tfvars.example terraform.tfvars
```

Edita `terraform.tfvars` y reemplaza el ID del proyecto, el usuario SSH, la clave pública OpenSSH y tu IP pública con `/32`. Nunca agregues una clave privada ni contraseñas de la aplicación a ese archivo. Después ejecuta:

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan
```

Lee el plan y confirma que solo creará la VM y dos reglas de firewall. Si está correcto:

```sh
terraform apply
```

Confirma con `yes` cuando Terraform muestre los recursos que va a crear. Al terminar, Terraform imprime la IP externa y el comando SSH. La IP es efímera: puede cambiar si detienes y vuelves a iniciar la VM. Actualiza el DNS del dominio si cambia.

El primer arranque instala Docker; puede tardar unos minutos. Terraform mostrará la IP externa y un comando SSH. Conéctate usando PuTTY y verifica:

```sh
sudo docker --version
sudo docker compose version
```

Luego clona el repositorio en la VM, crea allí el archivo `.env` con secretos nuevos y despliega la aplicación siguiendo las instrucciones principales del [README](../README.md). La plantilla no guarda el `.env` ni credenciales de la aplicación en Terraform.

## Costos y seguridad

- `e2-medium` tiene más memoria para compilar y ejecutar Spring Boot, PostgreSQL, Angular y Caddy. `e2-small` reduce el costo de cómputo, pero compilar en la VM puede ser lento o agotar la memoria; cambia `machine_type` solo si aceptas ese riesgo.
- Se usa disco persistente `pd-standard` y no se crea un balanceador de carga. La VM y el disco generan cargos mientras existan; detener la VM no elimina los cargos del disco. La IP externa efímera no está reservada aparte y puede cambiar al detener la VM.
- Los precios dependen de región, uso, descuentos e IPv4 vigente. Revisa el estimador de Google Cloud para tu proyecto antes de aplicar.
- No abras SSH (`22`) a `0.0.0.0/0`, ni publiques los puertos de PostgreSQL (`5432`) o backend (`8080`).
- La protección contra borrado está activada. Antes de eliminar la VM con Terraform, establece temporalmente `deletion_protection = false` en `main.tf` y aplica el cambio. Destruir la VM también elimina su disco de arranque y los datos PostgreSQL guardados allí; haz y verifica un respaldo externo primero.

## Cambiar tu IP SSH

Actualiza `ssh_source_cidr` en `terraform.tfvars` con la nueva IP pública y `/32`, y ejecuta `terraform apply`.
