# Educ.Pro IA v21

Versión basada en v16 con arranque más robusto.

## Novedad v21
Para evitar que vuelva a abrirse una versión vieja como v15/v18, el arranque local de v21 usa el puerto exclusivo 3021. Si está ocupado, prueba 3022, 3023, 3024, etc. Ya no es necesario cerrar manualmente Node.js por este motivo.

## Inicio
Ejecutá `INICIAR_EDUC_PRO.bat`. La ventana mostrará la dirección exacta, por ejemplo `http://localhost:3021` o, si está ocupado, `http://localhost:3022`, `3023`, etc..

## IA y producción
La clave de OpenAI debe configurarse en el servidor mediante `OPENAI_API_KEY`. Para producción también se requieren las variables de Mercado Pago indicadas en `.env.example`, HTTPS, dominio y una base de datos adecuada.

## Nota
El selector automático de puerto resuelve conflictos locales de arranque; no reemplaza la configuración de producción.


ETAPA 6 - USUARIOS Y PLANES
- Registro e inicio de sesión.
- Plan Gratis, Docente, Profesional e Institución.
- Límites mensuales de generaciones.
- El contador se reinicia automáticamente al comenzar un nuevo mes.
- Los planes pagos requieren Mercado Pago configurado para activarse.


## v21 — Despliegue en Render
Esta versión agrega el flujo de suscripción con Mercado Pago y actualización automática del plan mediante Webhook `subscription_preapproval`. La aplicación consulta el estado de la suscripción en `/preapproval/{id}` y activa Docente/Profesional cuando corresponde.

Variables necesarias en producción: `MP_ACCESS_TOKEN`, `MP_PLAN_DOCENTE`, `MP_PLAN_PROFESIONAL`, `MP_WEBHOOK_SECRET` y `APP_BASE_URL`. Mercado Pago recomienda validar la firma `x-signature` de los Webhooks.

Webhook a configurar: `https://TU-DOMINIO/api/webhooks/mercadopago` con el tópico de suscripciones. No pongas claves secretas dentro de `index.html`.


## v21 – IA local para pruebas
En una ejecución local, la pantalla **⚙️ Configuración IA** puede enviar la clave guardada en el navegador al backend únicamente desde localhost. En producción, el servidor usa exclusivamente `OPENAI_API_KEY` y no acepta la clave del navegador.

Las funciones de Cuadro sinóptico, Comparativo y Tabla incluyen instrucciones de formato para generar estructuras copiable/pegables en Word.


## Render / GitHub
Esta versión incluye `render.yaml` para desplegar como Web Service desde GitHub mediante Render Blueprint. Las claves secretas se configuran en Render como variables de entorno y no se guardan en el repositorio.


## 2) IA real — configuración

Educ.Pro IA v21 utiliza la **Responses API de OpenAI**. El modelo predeterminado es `gpt-5.6-luna` y puede cambiarse mediante `OPENAI_MODEL`.

### Prueba local
1. Copiá `.env.example` como `.env`.
2. En `.env`, colocá tu clave en `OPENAI_API_KEY=`.
3. Ejecutá `INICIAR_EDUC_PRO.bat`.
4. Iniciá sesión en Educ.Pro IA y generá una planificación de prueba.

También existe **⚙️ Configuración IA** para una prueba local. Esa opción no se utiliza como mecanismo de clave en producción.

### Producción
La clave debe quedar solamente en la variable de entorno `OPENAI_API_KEY` del servidor. **No la pegues en `index.html`, GitHub ni dentro del ZIP.**

El estado se puede comprobar en `/api/health`: devuelve la versión, el modelo y si el servidor detectó una clave configurada, pero nunca muestra la clave.
