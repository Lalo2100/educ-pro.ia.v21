const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static(__dirname));

const DATA_DIR=path.join(__dirname,'data');
const USERS_FILE=path.join(DATA_DIR,'users.json');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE,'[]');

const sessions=new Map();
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
  const sk=!!String(process.env.OPENAI_API_KEY||'').trim();
  const model=String(process.env.OPENAI_MODEL||'gpt-5.6-luna').trim();
  res.json({ok:true,commercial:true,version:'v21',configured:sk,serverKey:sk,model,paymentsConfigured:!!String(process.env.MP_ACCESS_TOKEN||'').trim()});
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
    const serverKey=String(process.env.OPENAI_API_KEY||'').trim();
    // Modo de prueba local: permite usar la clave guardada en Configuración IA
    // sin exponerla en producción. En producción se usa exclusivamente OPENAI_API_KEY.
    const browserKey=String(req.headers['x-openai-api-key']||'').trim();
    const isLocal=!['production'].includes(String(process.env.NODE_ENV||'').toLowerCase()) && (req.ip==='127.0.0.1'||req.ip==='::1'||req.ip==='::ffff:127.0.0.1');
    const key=serverKey || (isLocal && process.env.ALLOW_LOCAL_BROWSER_KEY!=='false' ? browserKey : '');
    if(!key)return res.status(503).json({error:isLocal?'La IA no está configurada. Abrí ⚙️ Configuración IA y guardá tu clave de OpenAI para esta prueba local.':'La IA no está configurada en el servidor. Configurá OPENAI_API_KEY en producción.'});
    const {prompt,context}=req.body||{};if(!prompt)return res.status(400).json({error:'No se recibió el pedido del docente.'});
    const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
    const client=new OpenAI({apiKey:key});
    const r=await client.responses.create({model,instructions:'Sos Educ.Pro IA, asistente especializado en planificación y producción de materiales educativos para docentes argentinos. Usá primero el material de referencia. No inventes citas. Respetá nivel, área y pedido. Entregá producción profesional lista para copiar a Word y respetá la arquitectura del modelo cuando se indique.',input:`PEDIDO DEL DOCENTE:\n${prompt}\n\nMATERIAL DE REFERENCIA Y BIBLIOTECA:\n${context||'(sin materiales)'}`});
    f.usage=(f.usage||0)+1;save(a);sessions.set(req.headers.authorization.replace(/^Bearer\s+/i,''),f);
    res.json({text:r.output_text||'',model,usage:f.usage,limit});
  }catch(e){
    console.error('ERROR /api/generate:',e);
    const m=String(e?.message||'Error al generar con OpenAI.');
    if(/401|Incorrect API key|invalid.*api key/i.test(m))return res.status(401).json({error:'La clave de OpenAI configurada es inválida. Revisá la configuración del servidor.'});
    res.status(500).json({error:m});
  }
});

// Mercado Pago: suscripciones recurrentes mediante planes previamente creados.
// En producción se configuran MP_ACCESS_TOKEN, MP_PLAN_DOCENTE, MP_PLAN_PROFESIONAL y APP_BASE_URL.
app.post('/api/subscribe',async(req,res)=>{
  try{
    const u=current(req);if(!u)return res.status(401).json({error:'Iniciá sesión antes de suscribirte.'});
    const plan=String(req.body?.plan||'');
    if(!['docente','profesional'].includes(plan))return res.status(400).json({error:'Plan de suscripción no válido.'});
    const access=String(process.env.MP_ACCESS_TOKEN||'').trim();
    if(!access)return res.status(503).json({error:'Mercado Pago todavía no está configurado en el servidor. Falta MP_ACCESS_TOKEN.'});
    const planId=plan==='docente'?String(process.env.MP_PLAN_DOCENTE||'').trim():String(process.env.MP_PLAN_PROFESIONAL||'').trim();
    if(!planId)return res.status(503).json({error:`Falta configurar MP_PLAN_${plan.toUpperCase()} en el servidor.`});
    const base=String(process.env.APP_BASE_URL||`http://localhost:${process.env.PORT||3000}`).replace(/\/$/,'');
    const body={preapproval_plan_id:planId,reason:`Educ.Pro IA - Plan ${plan}`,external_reference:u.id,payer_email:u.email,back_url:`${base}/?payment=return`};
    const r=await fetch('https://api.mercadopago.com/preapproval',{method:'POST',headers:{'Authorization':`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.error||'Mercado Pago rechazó la solicitud.'});
    const a=users(),f=a.find(x=>x.id===u.id);if(f){f.subscription={provider:'mercadopago',id:data.id,plan,status:data.status||'pending'};save(a);sessions.set(req.headers.authorization.replace(/^Bearer\s+/i,''),f);}
    res.json({ok:true,id:data.id,status:data.status,init_point:data.init_point});
  }catch(e){console.error('ERROR /api/subscribe:',e);res.status(500).json({error:e?.message||'No se pudo iniciar la suscripción.'});}
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
  const docente=String(process.env.MP_PLAN_DOCENTE||'').trim();
  const profesional=String(process.env.MP_PLAN_PROFESIONAL||'').trim();
  if(data.preapproval_plan_id===docente) plan='docente';
  if(data.preapproval_plan_id===profesional) plan='profesional';
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
    if(type==='subscription_preapproval' && id) await actualizarSuscripcionMP(id);
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
