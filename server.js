const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static(__dirname));

const DATA_DIR=path.join(__dirname,'data');
const USERS_FILE=path.join(DATA_DIR,'users.json');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE,'[]');

const sessions=new Map();
const rateBuckets=new Map();
function rateLimit(key, max=30, windowMs=60000){
  const now=Date.now(), b=rateBuckets.get(key);
  if(!b || now-b.start>=windowMs){rateBuckets.set(key,{start:now,count:1});return true;}
  b.count++;
  return b.count<=max;
}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();}
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if(req.path.startsWith('/api/') && !rateLimit(clientIp(req),60,60000))
    return res.status(429).json({error:'Demasiadas solicitudes. Esperá un momento e intentá nuevamente.'});
  next();
});
const limits={gratis:5,docente:100,profesional:300,institucion:1000};
const plans=[
  {id:'gratis',name:'Gratis',price:0,limit:5,description:'Para probar Educ.Pro IA'},
  {id:'docente',name:'Docente',price:4999,limit:100,description:'Para uso docente habitual'},
  {id:'profesional',name:'Profesional',price:8999,limit:300,description:'Para mayor volumen de producción'},
  {id:'institucion',name:'Institución',price:null,limit:1000,description:'Para escuelas e instituciones'}
];
const users=()=>{try{return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')||'[]')}catch{return[]}};
const save=u=>fs.writeFileSync(USERS_FILE,JSON.stringify(u,null,2));
const monthKey=()=>new Date().toISOString().slice(0,7);
function refreshUsage(u){if(u.usageMonth!==monthKey()){u.usage=0;u.usageMonth=monthKey();return true}return false;}
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const tok=()=>crypto.randomBytes(32).toString('hex');
const email=v=>String(v||'').trim().toLowerCase();
const current=req=>{const t=req.headers.authorization?.replace(/^Bearer\s+/i,'');return t?sessions.get(t):null};

app.get('/api/health',(req,res)=>{
  const openai=!!String(process.env.OPENAI_API_KEY||'').trim();
  const gemini=!!String(process.env.GEMINI_API_KEY||'').trim();
  const provider=String(process.env.AI_PROVIDER||'auto').trim().toLowerCase();
  const configured=provider==='gemini'?gemini:provider==='openai'?openai:(openai||gemini);
  const activeProvider = configured ? (provider==='auto' ? (gemini && !openai ? 'gemini' : openai && !gemini ? 'openai' : 'gemini') : provider) : 'none';
  const model=activeProvider==='gemini'
    ? String(process.env.GEMINI_MODEL||'gemini-3.8-flash').trim()
    : String(process.env.OPENAI_MODEL||'').trim();
  res.json({ok:true,commercial:true,version:'v21',configured,providers:{openai,gemini},provider:activeProvider,model,paymentsConfigured:!!String(process.env.MP_ACCESS_TOKEN||'').trim()});
});

app.post('/api/register',(req,res)=>{
  const e=email(req.body?.email),p=String(req.body?.password||'');
  if(!e.includes('@')||p.length<6)return res.status(400).json({error:'Ingresá un email válido y una contraseña de al menos 6 caracteres.'});
  const a=users();
  if(a.some(x=>x.email===e))return res.status(409).json({error:'Ya existe una cuenta con ese email.'});
  const u={id:crypto.randomUUID(),email:e,password:hash(p),plan:'gratis',usage:0,createdAt:new Date().toISOString(),subscription:null,usageMonth:monthKey()};
  a.push(u);save(a);const t=tok();sessions.set(t,u);
  res.json({token:t,user:{id:u.id,email:u.email,plan:u.plan,usage:0,limit:limits.gratis}});
});

app.post('/api/login',(req,res)=>{
  const e=email(req.body?.email),p=String(req.body?.password||''),u=users().find(x=>x.email===e&&x.password===hash(p));
  if(!u)return res.status(401).json({error:'Email o contraseña incorrectos.'});
  const t=tok();sessions.set(t,u);res.json({token:t,user:{id:u.id,email:u.email,plan:u.plan,usage:u.usage||0,limit:limits[u.plan]||5}});
});

app.post('/api/logout',(req,res)=>{const t=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(t)sessions.delete(t);res.json({ok:true})});
app.get('/api/me',(req,res)=>{const u=current(req);if(!u)return res.status(401).json({error:'Sesión no iniciada.'});const f=users().find(x=>x.id===u.id)||u;res.json({user:{id:f.id,email:f.email,plan:f.plan,usage:f.usage||0,limit:limits[f.plan]||5,subscription:f.subscription||null}})});
app.get('/api/plans',(req,res)=>res.json({plans}));

app.post('/api/generate',async(req,res)=>{
  try{
    const u=current(req);if(!u)return res.status(401).json({error:'Iniciá sesión para usar Educ.Pro IA.'});
    const a=users(),f=a.find(x=>x.id===u.id)||u;
    const changed=refreshUsage(f); if(changed) save(a);
    const limit=limits[f.plan]||5;
    if((f.usage||0)>=limit)return res.status(429).json({error:`Alcanzaste el límite de ${limit} generaciones de tu plan.`});

    const {prompt,context}=req.body||{};
    if(!prompt)return res.status(400).json({error:'No se recibió el pedido del docente.'});

    const provider=String(process.env.AI_PROVIDER||'auto').trim().toLowerCase();
    const openaiKey=String(process.env.OPENAI_API_KEY||'').trim();
    const geminiKey=String(process.env.GEMINI_API_KEY||'').trim();
    let chosen=provider;
    if(chosen==='auto') chosen=geminiKey?'gemini':(openaiKey?'openai':'none');
    if(chosen==='openai' && !openaiKey) chosen=geminiKey?'gemini':'none';
    if(chosen==='gemini' && !geminiKey) chosen=openaiKey?'openai':'none';
    if(chosen==='none')return res.status(503).json({error:'La IA no está configurada. En el servidor agregá GEMINI_API_KEY (recomendado) u OPENAI_API_KEY como variable secreta.'});

    const instructions='Sos Educ.Pro IA, asistente especializado en planificación y producción de materiales educativos para docentes argentinos. Priorizá el contexto de Córdoba cuando corresponda. Usá primero el material de referencia. No inventes citas, páginas, leyes, diseños curriculares ni atribuciones. Respetá nivel, área y pedido. Entregá una producción profesional, clara, completa y lista para copiar a Word. Si falta un dato institucional, dejalo como campo editable o propuesta, no lo inventes.';
    const input=`PEDIDO DEL DOCENTE:\n${prompt}\n\nMATERIAL DE REFERENCIA Y BIBLIOTECA:\n${context||'(sin materiales)'}`;
    let text='',model='';

    if(chosen==='openai'){
      if(!openaiKey) return res.status(503).json({error:'OpenAI no está configurado en el servidor. Usá Gemini o configurá OPENAI_API_KEY.'});
      return res.status(503).json({error:'Esta edición comercial está preparada para Gemini como proveedor principal. Configurá AI_PROVIDER=auto para habilitar OpenAI como alternativa.'});
    }else{
      // Producción: reintenta ante saturación y cambia automáticamente de modelo.
      const primary=String(process.env.GEMINI_MODEL||'gemini-3.8-flash').trim();
      const fallback=String(process.env.GEMINI_FALLBACK_MODELS||'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite')
        .split(',').map(x=>x.trim()).filter(Boolean);
      const models=[...new Set([primary,...fallback])];
      let lastErr=null;

      for(const candidateModel of models){
        for(let attempt=1;attempt<=2;attempt++){
          model=candidateModel;
          try{
            const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`,{
              method:'POST',
              headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},
              body:JSON.stringify({
                system_instruction:{parts:[{text:instructions}]},
                contents:[{role:'user',parts:[{text:input}]}],
                generationConfig:{maxOutputTokens:12000,thinkingConfig:{thinkingLevel:'medium'}}
              })
            });
            const raw=await r.text();
            let data={};
            try{data=JSON.parse(raw)}catch{data={error:{message:raw||'Respuesta no válida de Gemini.'}}}
            if(r.ok){
              text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
              if(text) break;
              lastErr=Object.assign(new Error('Gemini no devolvió contenido.'),{status:502});
            }else{
              const apiMessage=data?.error?.message||'Gemini no pudo generar la respuesta.';
              lastErr=Object.assign(new Error(apiMessage),{status:r.status});
              if([401,403,404].includes(r.status)) throw lastErr;
              const busy=/high demand|overloaded|temporarily unavailable|resource exhausted|rate limit|quota|too many requests/i.test(apiMessage);
              const transient=[429,500,502,503,504].includes(r.status)||busy;
              if(!transient) throw lastErr;
              if(attempt<2) await new Promise(resolve=>setTimeout(resolve,1500*Math.pow(2,attempt-1)));
            }
          }catch(err){
            lastErr=err;
            if([401,403,404].includes(err?.status)) throw err;
            if(attempt<2) await new Promise(resolve=>setTimeout(resolve,1500*Math.pow(2,attempt-1)));
          }
          if(text) break;
        }
        if(text) break;
      }
      if(!text) throw (lastErr||new Error('Gemini no pudo generar la respuesta.'));
    }

    if(!text)throw new Error('La IA no devolvió contenido.');
    f.usage=(f.usage||0)+1;save(a);
    sessions.set(req.headers.authorization.replace(/^Bearer\s+/i,''),f);
    res.json({text,model,provider:chosen,usage:f.usage,limit});
  }catch(e){
    console.error('ERROR /api/generate:',e);
    const m=String(e?.message||'Error al generar con IA.');
    if(/401|403|Incorrect API key|invalid.*api key|unauthorized|permission denied/i.test(m))
      return res.status(502).json({error:'Gemini rechazó la clave o no tiene permisos para usar el modelo. Verificá GEMINI_API_KEY en Render y que la clave pertenezca a un proyecto con la Gemini API habilitada.'});
    if(e?.status===429 || e?.status===503 || /high demand|overloaded|temporarily unavailable|quota|rate limit|resource exhausted|too many requests/i.test(m))
      return res.status(503).json({error:'La IA está momentáneamente ocupada. El servidor reintentó automáticamente y probó modelos alternativos. Esperá unos segundos y volvé a intentar.'});
    if(e?.status===404 || /not found|model.*not found/i.test(m))
      return res.status(502).json({error:`El modelo Gemini configurado (${model||'no indicado'}) no está disponible para esta API key. Cambiá GEMINI_MODEL por un modelo Gemini estable disponible.`});
    res.status(500).json({error:m});
  }
});

// Mercado Pago: suscripciones recurrentes sin plan previo. Mercado Pago permite crear /preapproval directamente.
app.post('/api/subscribe',async(req,res)=>{
  try{
    const u=current(req);if(!u)return res.status(401).json({error:'Iniciá sesión antes de suscribirte.'});
    const plan=String(req.body?.plan||'');
    if(!['docente','profesional'].includes(plan))return res.status(400).json({error:'Plan de suscripción no válido.'});

    const access=String(process.env.MP_ACCESS_TOKEN||'').trim();
    if(!access)return res.status(503).json({error:'Mercado Pago todavía no está configurado en el servidor.'});

    const price=plan==='docente'
      ? Number(process.env.MP_PRICE_DOCENTE||4999)
      : Number(process.env.MP_PRICE_PROFESIONAL||8999);
    if(!Number.isFinite(price)||price<=0)return res.status(503).json({error:'Precio de Mercado Pago no válido en el servidor.'});

    const base=String(process.env.APP_BASE_URL||`http://localhost:${process.env.PORT||3021}`).replace(/\/$/,'');
    const body={
      reason:`Educ.Pro IA - Plan ${plan}`,
      external_reference:u.id,
      payer_email:u.email,
      auto_recurring:{
        frequency:1,
        frequency_type:'months',
        transaction_amount:price,
        currency_id:'ARS'
      },
      back_url:`${base}/?payment=return`,
      status:'pending'
    };

    const r=await fetch('https://api.mercadopago.com/preapproval',{
      method:'POST',
      headers:{'Authorization':`Bearer ${access}`,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.error||'Mercado Pago rechazó la solicitud.'});

    const a=users(),f=a.find(x=>x.id===u.id);
    if(f){
      f.subscription={provider:'mercadopago',id:data.id,plan,status:data.status||'pending',lastUpdate:new Date().toISOString()};
      save(a);
      sessions.set(req.headers.authorization.replace(/^Bearer\s+/i,''),f);
    }
    res.json({ok:true,id:data.id,status:data.status,init_point:data.init_point});
  }catch(e){
    console.error('ERROR /api/subscribe:',e);
    res.status(500).json({error:e?.message||'No se pudo iniciar la suscripción.'});
  }
});

// Webhook de Mercado Pago: valida firma (si está configurado), consulta la suscripción
// y actualiza automáticamente el plan del usuario.
function validarFirmaMercadoPago(req){
  const secret=String(process.env.MP_WEBHOOK_SECRET||'').trim();
  if(!secret) return {ok:true,skipped:true}; // útil para pruebas locales; en producción configurarlo.
  const xs=String(req.headers['x-signature']||'');
  const xr=String(req.headers['x-request-id']||'');
  const dataId=String(req.query['data.id']||req.body?.data?.id||'');
  const ts=(xs.match(/(?:^|,)ts=([^,]+)/)||[])[1]||'';
  const v1=(xs.match(/(?:^|,)v1=([^,]+)/)||[])[1]||'';
  if(!ts||!v1||!dataId) return {ok:false};
  const manifest=`id:${dataId};request-id:${xr};ts:${ts};`;
  const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
  try{return {ok:crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(v1))};}catch{return {ok:false};}
}

async function actualizarSuscripcionMP(subscriptionId){
  const access=String(process.env.MP_ACCESS_TOKEN||'').trim();
  if(!access||!subscriptionId) return null;
  const r=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`,{headers:{'Authorization':`Bearer ${access}`}});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.message||data?.error||'No se pudo consultar la suscripción en Mercado Pago.');
  const a=users();
  const f=a.find(x=>x.id===String(data.external_reference||''));
  if(!f) return data;
  let plan=f.subscription?.plan||'gratis';
  if(!['docente','profesional'].includes(plan)) plan='gratis';
  const status=String(data.status||'').toLowerCase();
  const active=['authorized','active'].includes(status);
  f.subscription={provider:'mercadopago',id:data.id,plan,status,lastUpdate:new Date().toISOString()};
  f.plan=active?plan:'gratis';
  save(a);
  for(const [t,u] of sessions.entries()) if(u.id===f.id) sessions.set(t,f);
  return data;
}

app.post('/api/webhooks/mercadopago',async(req,res)=>{
  try{
    const sig=validarFirmaMercadoPago(req);
    if(!sig.ok) return res.sendStatus(401);
    const type=String(req.query.type||req.body?.type||'');
    const id=String(req.query['data.id']||req.body?.data?.id||'');
    console.log('Mercado Pago webhook:',type,id);
    if(['subscription_preapproval','subscription_preapproval_plan'].includes(type) && id) await actualizarSuscripcionMP(id);
    // Los pagos recurrentes también generan eventos; se aceptan y registran para auditoría.
    if(type==='subscription_authorized_payment' && id) console.log('Pago recurrente recibido:',id);
    res.sendStatus(200);
  }catch(e){
    console.error('ERROR webhook Mercado Pago:',e);
    res.sendStatus(500);
  }
});

app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Ruta API no encontrada.'});res.sendFile(path.join(__dirname,'index.html'));});
// En uso local se reserva el puerto 3021 para evitar conflictos con versiones antiguas (v15/v18).
const preferredPort=Number(process.env.PORT)||3021;
function iniciarEnPuerto(porto){
  const servidor=app.listen(porto,()=>{
    console.log(`Educ.Pro IA v21 disponible en http://localhost:${porto}`);
    console.log('El arranque local usa el puerto 3021 para evitar versiones antiguas; si está ocupado, prueba 3022, 3023, etc.');
  });
  servidor.on('error',(err)=>{
    if(err.code==='EADDRINUSE'){
      const siguiente=porto+1;
      console.log(`Puerto ${porto} ocupado. Probando puerto ${siguiente}...`);
      iniciarEnPuerto(siguiente);
    }else{
      console.error('No se pudo iniciar el servidor:',err);
      process.exit(1);
    }
  });
}
iniciarEnPuerto(preferredPort);
