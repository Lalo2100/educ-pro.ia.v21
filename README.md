# Educ.Pro IA v21 — Comercial Web

## IA Gemini
La aplicación usa Gemini del lado del servidor. Los docentes **no ingresan claves**.

### En PC Windows
1. Abrí `CONFIGURAR_GEMINI.bat`.
2. Pegá una nueva API key de Google AI Studio cuando el programa la solicite.
3. El programa instala las dependencias, inicia el servidor y abre `http://localhost:3021`.
4. No cierres la ventana negra del servidor mientras uses la aplicación.

La clave no se guarda en el código fuente ni dentro del ZIP.

### En Render
Configurá como variables secretas:
- `AI_PROVIDER=gemini`
- `GEMINI_MODEL=gemini-3.8-flash`
- `GEMINI_API_KEY=...`

Después de guardar la variable, hacé un nuevo deploy/restart.

### Comprobación
Abrí `/api/health`. Debe mostrar `configured:true`, `provider:gemini` y `model:gemini-3.8-flash`.

Gemini 3.8 Flash requiere la configuración moderna de thinking; el proyecto evita `temperature`, `top_p` y `top_k` en la llamada principal.

## Mercado Pago
Variables: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PRICE_DOCENTE`, `MP_PRICE_PROFESIONAL`, `APP_BASE_URL`.
