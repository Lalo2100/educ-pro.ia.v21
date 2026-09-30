# Edu.sistem Pro IA 2.2 SaaS

Base SaaS preparada a partir de la versión 2.1.

## Incluye
- Vercel/Express compatible.
- Biblioteca Curricular Córdoba local.
- Las 24 jurisdicciones en el selector de generación.
- Fallback dinámico de modelos Gemini.
- Planes Gratis, Docente, Profesional e Institución.
- Links de Mercado Pago configurados.
- Endpoint `/api/config` para configuración SaaS.
- Endpoint `/api/health` con versión 2.2.
- Módulo de cuenta local en el navegador.
- `supabase-schema.sql` para preparar cuentas persistentes.

## Variables de Vercel
La aplicación sigue usando `GEMINI_API_KEY`.
Opcionales para la siguiente etapa:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

No coloques claves privadas dentro del ZIP ni del repositorio.

## Importante
La cuenta local de esta versión es una base de interfaz y no reemplaza todavía una autenticación persistente. Para un SaaS comercial real, la siguiente etapa es conectar Supabase (o un backend equivalente) y registrar de forma segura suscripciones y consumos.
