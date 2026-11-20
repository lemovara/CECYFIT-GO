# CECYFIT GO!

El panel profesional vive en `web/` y la app de pacientes en `mobile/`. Cada aplicación tiene sus propias dependencias. Ambas usan el mismo proyecto Supabase.

## Desarrollo

1. Copia `web/.env.example` a `web/.env.local` y `mobile/.env.example` a `mobile/.env.local`.
2. Configura ambas con la URL y la clave publicable del mismo proyecto Supabase.
3. Instala y arranca cada aplicación en una terminal separada. En PowerShell con ejecución de scripts deshabilitada, usa `npm.cmd`.

| Aplicación | Instalar | Iniciar | Verificar |
| --- | --- | --- | --- |
| `web/` | `npm ci` | `npm run dev` | `npm run lint` y `npm run build` |
| `mobile/` | `npm ci` | `npm run start` | `npm run lint` y `npx tsc --noEmit` |

Las migraciones se guardan en `supabase/migrations/`. Para una instancia de prueba, aplica ambas en orden. El esquema asigna el rol `PACIENTE` a las altas de Auth. Un administrador del proyecto debe habilitar el rol `PROFESIONAL` para la cuenta que usará el panel. Mantén activa la confirmación por correo de Supabase Auth.

## Flujo de nutrición

1. En el panel, registra un paciente en **Clientes** y abre **Ver ficha**.
2. En **Vinculación**, genera una invitación para una ficha activa. Si la ficha tiene correo, la cuenta móvil debe confirmar ese mismo correo.
3. En el móvil, inicia sesión como paciente, escanea el QR o escribe el código y confirma la vinculación.
4. En la ficha web, abre **Plan nutricional** y asigna una comida para la fecha de prueba.
5. En Android, abre **Dietas**, selecciona esa fecha, abre el platillo y registra su consumo.
6. En la misma ficha web, abre **Seguimiento**, selecciona la fecha y pulsa **Actualizar** para ver el registro.

Las fechas y horarios del menú usan la zona `America/Mexico_City`. Las pantallas marcadas como demostración usan datos ilustrativos.
