# Inventario Condominio Playa La Honda

Aplicación Angular + Spring Boot + PostgreSQL para controlar consumibles, combustible por unidad fraccionaria, activos con QR privado y préstamos con historial de devolución/condición. Cada condominio debe tener su propia instalación y base de datos.

## Puesta en marcha local con Docker

1. Copia `.env.example` a `.env` y reemplaza los valores de ejemplo por contraseñas únicas. `BOOTSTRAP_ADMIN_PASSWORD` debe tener entre 12 y 72 caracteres.
2. Ejecuta `docker compose up --build` y abre `http://localhost:8000`.
3. Configura `COOKIE_SECURE=false` solo para pruebas locales por HTTP. En despliegues reales usa HTTPS y `COOKIE_SECURE=true`.

No se incluyen credenciales predeterminadas. El administrador inicial se crea desde `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_PASSWORD`; esos valores no se vuelven a aplicar cuando ya hay un administrador activo. Cambia la contraseña bootstrap después de iniciar y elimina los secretos del entorno de despliegue según la política operativa.

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
