# Inventario Condominio Playa La Honda

Aplicación Angular + Spring Boot + PostgreSQL para controlar consumibles, combustible por unidad fraccionaria, activos con QR privado y préstamos con historial de devolución/condición. Cada condominio debe tener su propia instalación y base de datos.

## Productos y personas

Las cuentas de acceso son independientes del padrón de trabajadores. Registra a los trabajadores en **Personal** sin crearles correo ni contraseña; los préstamos permiten elegir un trabajador registrado o escribir el nombre de un propietario. Las salidas y custodias también guardan el nombre de la persona sin exigir que tenga una cuenta.

Al crear un producto, el código se genera con el formato `CAT-PRO-VAR-001`: abreviaturas de tres letras de categoría, producto y variante, más el número inicial con tres dígitos. El formulario permite indicar una existencia inicial de 1 a 50; esa cantidad corresponde al stock de un solo producto y no crea claves distintas por unidad.

## Exportación, carga masiva y etiquetas QR

- En **Productos**, los filtros de búsqueda y categoría también aplican a la exportación: «Exportar Excel» genera un `.xlsx` con una fila por producto filtrado y «Imprimir / PDF» genera el reporte con encabezado institucional para imprimirlo o guardarlo como PDF. En **Reportes**, la exportación de movimientos también entrega un `.xlsx`.
- Los administradores pueden cargar productos masivamente: «Importar Excel» descarga una plantilla con la guía de columnas, acepta `.xlsx` o `.csv`, muestra una vista previa fila por fila (lista, omitida o con error) y solo envía las filas válidas al confirmar. Cada fila se crea en su propia transacción, los códigos existentes o repetidos se omiten sin duplicar y un error de fila no invalida el resto del archivo (máximo 500 productos por archivo).
- La impresión de QR usa una hoja A4 vertical con **4 columnas de etiquetas** (código, producto, serie y área): selecciona los activos con las casillas de la tabla y usa «Imprimir QR (n)», o imprime desde la ficha individual del activo.
- Escanear un QR abre la ficha del activo en `/qr/<token>`; si no hay sesión, tras iniciar sesión la ficha se carga directamente. Los datos QR siguen exigiendo autenticación.

## Préstamos rápidos

- El registro de préstamos es de un solo paso: escribe quién recibe (si el nombre coincide con Personal se registra como trabajador; si no, como propietario o invitado), agrega uno o más artículos a la lista y confirma. El motivo y la fecha límite son opcionales; el motivo vacío se guarda como «Préstamo de almacén».
- Cada préstamo abierto muestra «Devolver todo», que recibe todos los artículos pendientes en una sola operación con la condición indicada. La devolución individual preselecciona la totalidad de lo pendiente (cantidad y unidades) para confirmar con un clic.
- La ficha QR de un activo prestado incluye «Registrar devolución de este activo» y abre la devolución correspondiente desde el escaneo.
- Los préstamos con fecha límite vencida se marcan como **Vencido** en el listado.

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
