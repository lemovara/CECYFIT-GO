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

## Hidratación

El profesional puede indicar una meta diaria en **Clientes → Ver ficha → Salud**. En Android, **Salud integral** muestra el avance de hoy y permite registrar 250 ml u otra cantidad. **Seguimiento** en la web muestra los registros por fecha. La meta que se muestra es la vigente en la ficha.

## Registro de paciente en Android

En **Crear cuenta de paciente**, el paciente escribe sus datos y confirma el correo con el código que recibe. Si usó el enlace del correo, puede volver a la pantalla de confirmación y elegir **Ya confirmé con el enlace**. Después escanea el QR o ingresa el código de vinculación que generó su profesional.

En Supabase configura un [remitente SMTP propio](https://supabase.com/docs/guides/auth/auth-smtp) para enviar correos a pacientes y conserva activa la confirmación por correo. En **Authentication → Email Templates → Confirm signup**, usa [la plantilla del proyecto](supabase/templates/confirm-signup.html) para incluir el código en el correo y conservar el enlace de confirmación. El código se comprueba con Supabase Auth.

## API de comidas

El panel llama a `assign_patient_meal` mediante Supabase RPC. Recibe el ID de la ficha, fecha, horario con precisión de minutos, nombre del platillo e ingredientes, indicaciones y calorías opcionales. Devuelve el ID de la comida. Las políticas existentes de Supabase restringen el alta a fichas activas del profesional. Para una misma ficha, fecha y horario puede haber una sola comida.

En **Plan nutricional**, el calendario muestra la semana y cuántas comidas hay en cada día. Selecciona un día futuro para editar una comida o copiar el menú de otra fecha del mismo paciente. Guardar publica el cambio en el menú móvil. Si la copia encuentra un horario ocupado, se cancela completa. La edición usa `update_patient_meal` y comprueba la revisión de la comida para detectar cambios concurrentes. La copia usa `copy_patient_meals` y copia el plan sin arrastrar registros de consumo.

En Android, abre **Dietas → Registrar comida fuera del plan** para guardar el alimento, la cantidad consumida y las calorías si las conoces. El profesional puede consultar el registro seleccionando esa fecha en **Seguimiento**. Estas entradas se guardan aparte del menú asignado.

El paciente también puede buscar ingredientes y recetas del catálogo y, mediante **Buscar productos por nombre**, consultar Open Food Facts. Para los ingredientes indica gramos; para una receta, una fracción de la receta completa mostrada; y para un producto confirma si su etiqueta expresa los valores por 100 g o por 100 ml. La aplicación muestra una estimación de energía y macronutrientes y conserva una copia de esos valores y su fuente con el registro; el profesional la consulta en **Seguimiento**. El estado del alimento elegido debe corresponder al consumido. Las búsquedas requieren conexión, y el registro manual continúa disponible cuando no se encuentra el alimento. Los valores son declarados por el paciente y no sustituyen la revisión profesional.

Al registrar un alimento adicional se puede indicar la hora aproximada de consumo en formato de 24 horas, asociada a la fecha seleccionada y a la zona de Ciudad de México. La hora de recepción en el servidor se muestra aparte. En el panel, **Seguimiento** compara energía, proteína, carbohidratos, grasas y fibra del plan con lo registrado; si faltan datos o comidas por registrar, indica que los totales son parciales y evita mostrar una diferencia completa.

Si el paciente ya inició sesión y abrió su ficha, en Android e iOS estos registros pueden guardarse cifrados en el dispositivo cuando no hay conexión. Aparecen como pendientes y se reintentan mientras la aplicación está abierta o vuelve a primer plano; también se pueden reintentar manualmente. Se sincronizan con la misma cuenta y ficha, y solo se retiran de la cola cuando el servidor confirma el registro. En **Dietas**, cada semana consultada en línea también se guarda cifrada; ante una falla de red puede consultarse su última copia, con fecha y aviso de que podría estar desactualizada. La ficha, los ingredientes y las indicaciones de ese menú se pueden abrir sin conexión, y la despensa usa los ingredientes guardados. También se puede marcar una comida del plan como consumida o no consumida: si el profesional modificó el plan o el estado cambió desde otro dispositivo, el registro queda pendiente de revisión para que el paciente decida descartarlo y consultar el estado actualizado. Los menús guardados antes de esta función deben actualizarse una vez en línea para habilitar estos registros. Tras reiniciar la aplicación, el acceso a la copia depende de que Supabase recupere una sesión local aún vigente y de que la vinculación se haya comprobado previamente; al vencerse la sesión se necesita conexión. La app no puede conocer una revocación mientras no haya conexión y vuelve a verificar al conectarse. Consultar precios todavía requiere conexión. En la versión web el menú y el registro siguen requiriendo conexión.

## Recetario, dieta y despensa

- **Panel profesional.** Abre **Clientes → Ver ficha → Plan nutricional**. En **Recetario** busca por título o ingrediente, revisa los gramajes y publica la receta con su horario. **Información general** y **Salud** permiten guardar el objetivo, las restricciones, el peso y la estatura que se comparten con el paciente.
- **Recetas externas.** En el catálogo del panel, escribe un alimento y pulsa **Buscar recetas externas** para consultar en vivo la colección USDA MyPlate Kitchen conservada por [MyPlate.food](https://myplate.food/recipes). Abre el enlace en español y prepara una asignación con las cantidades e indicaciones que revises. Si eliges ingredientes del catálogo, el sistema calcula sus nutrientes, guarda una receta privada y agrega esos ingredientes a la despensa del paciente; el texto manual no genera ingredientes automáticamente.
- **Android.** En **Dietas** selecciona un día de la semana y abre una comida para marcar su consumo. **Perfil → Mi ingesta** permite entrar a Dietas o registrar una comida fuera del plan de hoy. **Despensa y supermercados** calcula el costo de la cantidad usada por comida y el desembolso por presentaciones completas para el día o la semana.
- **Tlaxcala.** Selecciona Soriana, Walmart, Chedraui, Bodega Aurrera o Sam’s Club. Las sucursales con registros compatibles de [Profeco](https://datos.profeco.gob.mx/index.php) ofrecen precios observados del 9 al 13 de marzo de 2026 que aparecen con fecha, marca y presentación. Sam’s Club no tiene observaciones en el corte importado. Puedes elegir otra sucursal y guardar precios por paquete o por kilo, con el peso aprovechable cuando aplique. Tus precios se guardan por cuenta y sucursal y tienen prioridad. El subtotal solo incluye ingredientes con precio.
- **Datos nutricionales.** Las cifras del catálogo inicial son aproximaciones calculadas según los gramos de cada ingrediente en el estado indicado, con referencia a [FoodData Central](https://fdc.nal.usda.gov/).

Las fotos son ilustrativas. Las fichas enlazadas indican autoría y licencia.

Para incorporar un corte oficial posterior, ejecuta `python supabase/scripts/import-profeco.py <archivo.csv>` sobre el CSV de Quién es Quién en los Precios. Guarda el SQL que emite en una migración nueva. El importador conserva la observación más reciente por ingrediente y sucursal y descarta productos incompatibles con el recetario, como pollo entero en lugar de pechuga sin hueso.

- [Kycklingfilé.jpg](https://commons.wikimedia.org/wiki/File:Kycklingfil%C3%A9.jpg)
- [Rice grains (IRRI).jpg](https://commons.wikimedia.org/wiki/File:Rice_grains_(IRRI).jpg)
- [Cut Broccoli.jpg](https://commons.wikimedia.org/wiki/File:Cut_Broccoli.jpg)
- [Carrots.jpg](https://commons.wikimedia.org/wiki/File:Carrots.jpg)
- [Rolled Oats.jpg](https://commons.wikimedia.org/wiki/File:Rolled_Oats.jpg)
- [Banana (partially peeled).jpg](https://commons.wikimedia.org/wiki/File:Banana_(partially_peeled).jpg)
- [Tomato (1).jpg](https://commons.wikimedia.org/wiki/File:Tomato_(1).jpg)
- [Black beans (1126927794).jpg](https://commons.wikimedia.org/wiki/File:Black_beans_(1126927794).jpg)
- [Chicken and rice.jpg](https://commons.wikimedia.org/wiki/File:Chicken_and_rice.jpg)
- [Chicken breast on Vegetables.jpg](https://commons.wikimedia.org/wiki/File:Chicken_breast_on_Vegetables.jpg)
- [Banana oatmeal.jpg](https://commons.wikimedia.org/wiki/File:Banana_oatmeal.jpg)
- [Simple Vegetable Rice.jpg](https://commons.wikimedia.org/wiki/File:Simple_Vegetable_Rice.jpg)
