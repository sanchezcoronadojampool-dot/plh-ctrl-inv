# Inventario Condominio Playa La Honda

Aplicación Angular + Spring Boot + PostgreSQL para controlar consumibles, combustible por unidad fraccionaria, activos con QR privado y préstamos con historial de devolución/condición. Cada condominio debe tener su propia instalación y base de datos.

## Despliegue con Docker Compose

La app se publica detrás del proxy compartido en su propio hostname; no expone puertos de frontend, backend ni PostgreSQL al host.

1. Copia `.env.example` a `.env` y reemplaza cada marcador por valores únicos. `BOOTSTRAP_ADMIN_PASSWORD` debe tener entre 12 y 72 caracteres.
2. Crea una sola vez la red compartida del proxy: `docker network create web` (si ya existe, no hace falta recrearla).
3. Desde esta carpeta, ejecuta `docker compose config --quiet` y luego `docker compose up -d --build`.
4. Abre la app por HTTPS desde `https://inventario-plh-condominio.duckdns.org`. Consulta la configuración de DuckDNS y de los hostnames en el README del proxy compartido.

`COOKIE_SECURE=true` es el valor seguro para el despliegue HTTPS. Solo establécelo en `false` para pruebas locales controladas por HTTP; no publiques así una instalación comercial.

**Rotación de secretos antes del piloto:** el archivo `.env` local se conservó y dejó de seguirse en Git, pero su versión anterior puede permanecer en commits previos. Rota la contraseña de PostgreSQL y la del administrador inicial; retirar el archivo del seguimiento no revoca ni borra valores históricos.

No se incluyen credenciales predeterminadas. El administrador inicial se crea desde `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_PASSWORD`; esos valores no se vuelven a aplicar cuando ya hay un administrador activo. Cambia la contraseña bootstrap después de iniciar y elimina los secretos del entorno de despliegue según la política operativa. Nunca compartas la salida de `docker compose config`: puede mostrar los valores resueltos.

## Migraciones y datos existentes

Flyway ejecuta las migraciones PostgreSQL versionadas en `backend/src/main/resources/db/migration/`. En una base existente sin historial Flyway, se marca la versión 1 como baseline y luego se aplican las versiones posteriores; `V3` registra el stock existente como saldo de apertura porque no puede reconstruir movimientos históricos no guardados. Haz respaldo completo antes de actualizar una base existente y verifica el resultado de conciliación después de la migración. No elimines `flyway_schema_history`.

Las cuentas heredadas no tienen contraseña verificable y quedan deshabilitadas. El administrador bootstrap reactiva o crea la cuenta inicial; un administrador debe crear nuevas credenciales para el personal. No habilites el perfil `demo` en un despliegue real: contiene usuarios y datos de prueba.

## Desarrollo y pruebas

- Backend: `cd backend` y `.\mvnw.cmd test`. Las pruebas usan H2 con datos de demo.
- Frontend: `cd frontend`, `npm ci`, `npm start` para desarrollo y `npm run build` / `npm test -- --watch=false` para validar.
- Para PostgreSQL local, configura `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` y las tres variables `BOOTSTRAP_ADMIN_*`; no uses contraseñas de ejemplo.

La sesión se conserva mediante cookie HTTP-only y las mutaciones exigen CSRF. Los datos QR y sus historiales requieren autenticación. El frontend se sirve en el mismo origen que `/api`; no expongas el backend directamente a Internet sin HTTPS y una política de red adecuada.

### Diagnóstico de conexión PostgreSQL

`FATAL: password authentication failed for user "postgres"` significa que la API sí alcanzó PostgreSQL, pero `DB_USERNAME`/`DB_PASSWORD` no coinciden con la cuenta de esa instalación. Configura esas variables en la configuración de ejecución del IDE o en la sesión de PowerShell; `.env` lo lee Docker Compose, no `mvnw.cmd`. El usuario predeterminado para ejecución local es `postgres`; cámbialo si tu servidor usa otra cuenta. En Compose, el usuario es `condominio`. No elimines el volumen para resolver este error: cambiar `DB_PASSWORD` en `.env` no cambia automáticamente la contraseña dentro de una base ya inicializada; rota la clave en PostgreSQL de forma explícita y actualiza el secreto de la aplicación.
