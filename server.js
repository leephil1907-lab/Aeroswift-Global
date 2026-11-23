import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import { Resend } from "resend";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false, max: 5 });
const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_HOST = process.env.ADMIN_HOST?.trim().toLowerCase();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false });
app.use("/api", limiter);

const query = (sql, values = []) => pool.query(sql, values);
const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = row => ({ id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at });
const tokenCookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 };

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d", issuer: "aeroswift" });
  res.cookie("aeroswift_session", token, tokenCookie);
}
async function auth(req, res, next) {
  try {
    const token = req.cookies.aeroswift_session;
    if (!token) return res.status(401).json({ error: "Sign in to continue." });
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: "aeroswift" });
    const result = await query("SELECT id,name,email,role,created_at FROM users WHERE id=$1 AND active=true", [decoded.sub]);
    if (!result.rowCount) return res.status(401).json({ error: "Your session is no longer active." });
    req.user = result.rows[0];
    next();
  } catch { res.clearCookie("aeroswift_session", tokenCookie); return res.status(401).json({ error: "Your session has expired. Sign in again." }); }
}
const adminOnly = (req, res, next) => req.user?.role === "admin" ? next() : res.status(403).json({ error: "Administrator access required." });

async function initDatabase() {
  const schema = await fs.readFile(path.join(__dirname, "db/schema.sql"), "utf8");
  await query(schema);
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const existing = await query("SELECT id FROM users WHERE email=$1", [ADMIN_EMAIL]);
    if (!existing.rowCount) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')", ["AeroSwift Administrator", ADMIN_EMAIL, hash]);
      console.log("Initial administrator account created from deployment environment.");
    }
  }
}

async function sendEmail({ to, subject, text, replyTo }) {
  if (!resend || !process.env.AEROSWIFT_ENQUIRY_FROM || !to) return;
  try { await resend.emails.send({ from: process.env.AEROSWIFT_ENQUIRY_FROM, to, subject, text, replyTo }); }
  catch (error) { console.error("Email notification failed:", error?.message || error); }
}

app.get("/api/health", async (_req, res) => {
  try { await query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});

app.post("/api/auth/register", async (req, res) => {
  const name = clean(req.body?.name, 120), email = clean(req.body?.email, 180).toLowerCase(), password = String(req.body?.password || "");
  if (name.length < 2 || !emailValid(email) || password.length < 10) return res.status(400).json({ error: "Enter a name, valid email and password of at least 10 characters." });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id,name,email,role,created_at", [name,email,hash]);
    issueSession(res, result.rows[0]);
    res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) { if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." }); console.error(error); res.status(500).json({ error: "Account could not be created." }); }
});
app.post("/api/auth/login", async (req, res) => {
  const email = clean(req.body?.email, 180).toLowerCase(), password = String(req.body?.password || "");
  const result = await query("SELECT * FROM users WHERE email=$1 AND active=true", [email]);
  if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
  issueSession(res, result.rows[0]);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,ip_address) VALUES($1,'login','user',$1,$2)", [result.rows[0].id, req.ip]);
  res.json({ user: publicUser(result.rows[0]) });
});
app.post("/api/auth/logout", (_req, res) => { res.clearCookie("aeroswift_session", tokenCookie); res.json({ ok: true }); });
app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post("/api/enquiries", async (req, res) => {
  const name = clean(req.body?.name,120), email = clean(req.body?.email,180).toLowerCase(), topic = clean(req.body?.topic || "General enquiry",120), message = clean(req.body?.message,5000);
  if (clean(req.body?.website,200)) return res.json({ ok: true });
  if (name.length < 2 || !emailValid(email) || message.length < 5) return res.status(400).json({ error: "Enter your name, a valid email address and a message." });
  try {
    const result = await query("INSERT INTO enquiries(name,email,topic,message,source) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at", [name,email,topic,message,clean(req.body?.source || "website",80)]);
    await sendEmail({ to: process.env.AEROSWIFT_ENQUIRY_TO, subject: "AeroSwift enquiry: " + topic, text: `New website enquiry #${result.rows[0].id}\nName: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`, replyTo: email });
    res.status(201).json({ ok: true, reference: result.rows[0].id, message: "Your enquiry has been received. The AeroSwift team will follow up." });
  } catch (error) { console.error(error); res.status(500).json({ error: "Your enquiry could not be saved. Please try again." }); }
});
app.post("/api/contact", (req,res,next) => { req.url="/api/enquiries"; next(); });

app.post("/api/support/tickets", auth, async (req,res) => {
  const subject=clean(req.body?.subject,180), message=clean(req.body?.message,5000), category=clean(req.body?.category || "General",80);
  if(subject.length<4 || message.length<5) return res.status(400).json({error:"Enter a subject and message."});
  const result=await query("INSERT INTO tickets(user_id,subject,category,status,priority) VALUES($1,$2,$3,'open','normal') RETURNING *",[req.user.id,subject,category]);
  await query("INSERT INTO ticket_messages(ticket_id,sender_id,body,is_internal) VALUES($1,$2,$3,false)",[result.rows[0].id,req.user.id,message]);
  res.status(201).json({ticket:result.rows[0]});
});
app.get("/api/support/tickets", auth, async (req,res) => {
  const rows = req.user.role==="admin" ? await query("SELECT t.*,u.name AS customer_name,u.email AS customer_email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC") : await query("SELECT * FROM tickets WHERE user_id=$1 ORDER BY updated_at DESC",[req.user.id]);
  res.json({tickets:rows.rows});
});
app.get("/api/support/tickets/:id/messages", auth, async (req,res) => {
  const owns = req.user.role==="admin" ? await query("SELECT id FROM tickets WHERE id=$1",[req.params.id]) : await query("SELECT id FROM tickets WHERE id=$1 AND user_id=$2",[req.params.id,req.user.id]);
  if(!owns.rowCount) return res.status(404).json({error:"Ticket not found."});
  const messages=await query("SELECT m.id,m.body,m.created_at,m.is_internal,u.name AS sender_name,u.role AS sender_role FROM ticket_messages m JOIN users u ON u.id=m.sender_id WHERE m.ticket_id=$1 AND ($2='admin' OR m.is_internal=false) ORDER BY m.created_at",[req.params.id,req.user.role]);
  res.json({messages:messages.rows});
});
app.post("/api/support/tickets/:id/replies", auth, async (req,res) => {
  const body=clean(req.body?.message,5000);
  if(body.length<1) return res.status(400).json({error:"Enter a reply."});
  const owns=req.user.role==="admin" ? await query("SELECT * FROM tickets WHERE id=$1",[req.params.id]) : await query("SELECT * FROM tickets WHERE id=$1 AND user_id=$2",[req.params.id,req.user.id]);
  if(!owns.rowCount) return res.status(404).json({error:"Ticket not found."});
  const result=await query("INSERT INTO ticket_messages(ticket_id,sender_id,body,is_internal) VALUES($1,$2,$3,false) RETURNING *",[req.params.id,req.user.id,body]);
  await query("UPDATE tickets SET updated_at=now(),status=CASE WHEN $2='admin' THEN 'waiting_customer' ELSE 'open' END WHERE id=$1",[req.params.id,req.user.role]);
  if(req.user.role==="admin") {
    const customer=await query("SELECT u.email FROM users u JOIN tickets t ON t.user_id=u.id WHERE t.id=$1",[req.params.id]);
    await sendEmail({to:customer.rows[0]?.email,subject:"AeroSwift support replied to your ticket",text:body});
  }
  res.status(201).json({message:result.rows[0]});
});

app.get("/api/customer/shipments",auth,async(req,res)=>{
 const rows=await query("SELECT id,tracking_number,carrier,status,estimated_delivery,created_at FROM shipments WHERE customer_id=$1 ORDER BY created_at DESC",[req.user.id]);
 res.json({shipments:rows.rows});
});
app.get("/api/admin/overview",auth,adminOnly,async(_req,res)=>{
 const [enquiries,tickets,shipments,customers,documents]=await Promise.all([
 query("SELECT count(*)::int AS count FROM enquiries WHERE status<>'archived'"),
 query("SELECT count(*)::int AS count FROM tickets WHERE status IN ('open','waiting_admin')"),
 query("SELECT count(*)::int AS count FROM shipments"),
 query("SELECT count(*)::int AS count FROM users WHERE role='customer'"),
 query("SELECT count(*)::int AS count FROM documents")
 ]);
 res.json({enquiries:enquiries.rows[0].count,openTickets:tickets.rows[0].count,shipments:shipments.rows[0].count,customers:customers.rows[0].count,documents:documents.rows[0].count});
});
app.get("/api/admin/enquiries",auth,adminOnly,async(_req,res)=>{
 const rows=await query("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 200"); res.json({enquiries:rows.rows});
});
app.post("/api/admin/enquiries/:id/reply",auth,adminOnly,async(req,res)=>{
 const message=clean(req.body?.message,5000); if(!message) return res.status(400).json({error:"Reply cannot be empty."});
 const item=await query("SELECT * FROM enquiries WHERE id=$1",[req.params.id]); if(!item.rowCount) return res.status(404).json({error:"Enquiry not found."});
 await query("INSERT INTO enquiry_replies(enquiry_id,admin_id,body) VALUES($1,$2,$3)",[req.params.id,req.user.id,message]);
 await query("UPDATE enquiries SET status='replied',updated_at=now() WHERE id=$1",[req.params.id]);
 await sendEmail({to:item.rows[0].email,subject:"AeroSwift response: "+item.rows[0].topic,text:message});
 res.json({ok:true});
});
app.patch("/api/admin/enquiries/:id",auth,adminOnly,async(req,res)=>{
 const status=clean(req.body?.status,30); if(!["new","in_progress","replied","archived"].includes(status)) return res.status(400).json({error:"Invalid enquiry status."});
 await query("UPDATE enquiries SET status=$1,updated_at=now() WHERE id=$2",[status,req.params.id]); res.json({ok:true});
});
app.get("/api/admin/tickets",auth,adminOnly,async(_req,res)=>{
 const rows=await query("SELECT t.*,u.name AS customer_name,u.email AS customer_email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC LIMIT 200"); res.json({tickets:rows.rows});
});
app.patch("/api/admin/tickets/:id",auth,adminOnly,async(req,res)=>{
 const status=clean(req.body?.status,30),priority=clean(req.body?.priority,20);
 if(!["open","waiting_admin","waiting_customer","resolved","closed"].includes(status)||!["low","normal","high","urgent"].includes(priority)) return res.status(400).json({error:"Invalid ticket status or priority."});
 await query("UPDATE tickets SET status=$1,priority=$2,updated_at=now() WHERE id=$3",[status,priority,req.params.id]); res.json({ok:true});
});
app.get("/api/admin/shipments",auth,adminOnly,async(_req,res)=>{const r=await query("SELECT s.*,u.name AS customer_name,u.email AS customer_email FROM shipments s LEFT JOIN users u ON u.id=s.customer_id ORDER BY s.created_at DESC LIMIT 200");res.json({shipments:r.rows});});
app.post("/api/admin/shipments",auth,adminOnly,async(req,res)=>{
 const tracking=clean(req.body?.trackingNumber,100),carrier=clean(req.body?.carrier,80),customerEmail=clean(req.body?.customerEmail,180).toLowerCase();
 if(!tracking||!carrier) return res.status(400).json({error:"Tracking number and carrier are required."});
 const customer=customerEmail?await query("SELECT id FROM users WHERE email=$1 AND role='customer'",[customerEmail]):{rows:[]};
 const r=await query("INSERT INTO shipments(customer_id,tracking_number,carrier,status,origin,destination,estimated_delivery) VALUES($1,$2,$3,'registered',$4,$5,$6) RETURNING *",[customer.rows[0]?.id||null,tracking,carrier,clean(req.body?.origin,120),clean(req.body?.destination,120),req.body?.estimatedDelivery||null]);
 await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'shipment_created','shipment',$2)",[req.user.id,r.rows[0].id]);
 res.status(201).json({shipment:r.rows[0]});
});
app.get("/api/admin/documents",auth,adminOnly,async(_req,res)=>{const r=await query("SELECT d.*,u.name AS customer_name FROM documents d LEFT JOIN users u ON u.id=d.customer_id ORDER BY d.created_at DESC LIMIT 200");res.json({documents:r.rows});});
app.post("/api/admin/documents",auth,adminOnly,async(req,res)=>{
 const type=clean(req.body?.type,20),number=clean(req.body?.number,80),customerName=clean(req.body?.customerName,150),customerEmail=clean(req.body?.customerEmail,180).toLowerCase(),currency=clean(req.body?.currency||"USD",5),items=Array.isArray(req.body?.items)?req.body.items.slice(0,30):[];
 if(!["invoice","receipt"].includes(type)||!number||!customerName||!items.length) return res.status(400).json({error:"Document type, number, customer and at least one line item are required."});
 const normalized=items.map(x=>({description:clean(x.description,200),quantity:Math.max(1,Number(x.quantity)||1),unitPrice:Math.max(0,Number(x.unitPrice)||0)}));
 const total=normalized.reduce((sum,x)=>sum+x.quantity*x.unitPrice,0);
 const cust=customerEmail?await query("SELECT id FROM users WHERE email=$1",[customerEmail]):{rows:[]};
 const r=await query("INSERT INTO documents(type,number,customer_id,customer_name,customer_email,currency,items,total,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[type,number,cust.rows[0]?.id||null,customerName,customerEmail||null,currency,JSON.stringify(normalized),total,clean(req.body?.notes,1500),req.user.id]);
 res.status(201).json({document:r.rows[0]});
});
app.get("/api/admin/documents/:id/download",auth,adminOnly,async(req,res)=>{
 const r=await query("SELECT * FROM documents WHERE id=$1",[req.params.id]); if(!r.rowCount) return res.status(404).json({error:"Document not found."});
 const d=r.rows[0],format=clean(req.query.format||"pdf",10).toLowerCase(),items=Array.isArray(d.items)?d.items:[];
 const safeName=(d.number||"document").replace(/[^a-z0-9_-]/gi,"_");
 if(format==="pdf"){
  res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${safeName}.pdf"`);
  const pdf=new PDFDocument({margin:48});pdf.pipe(res);pdf.fontSize(22).fillColor("#08182b").text("AEROSWIFT GLOBAL");pdf.moveDown(.4);pdf.fontSize(18).text(d.type.toUpperCase());pdf.fontSize(10).fillColor("#667085").text("Document "+d.number);pdf.moveDown();pdf.fillColor("#101828").fontSize(12).text("Bill to: "+d.customer_name);if(d.customer_email)pdf.text(d.customer_email);pdf.moveDown();items.forEach((it,i)=>pdf.text(`${i+1}. ${it.description} — ${it.quantity} × ${Number(it.unitPrice).toFixed(2)} ${d.currency}`));pdf.moveDown();pdf.fontSize(16).text("Total: "+Number(d.total).toFixed(2)+" "+d.currency,{align:"right"});if(d.notes){pdf.moveDown().fontSize(10).text(d.notes);}pdf.end();return;
 }
 if(format==="docx"){
  const children=[new Paragraph({text:"AEROSWIFT GLOBAL",heading:HeadingLevel.TITLE}),new Paragraph({text:d.type.toUpperCase(),heading:HeadingLevel.HEADING_1}),new Paragraph("Document "+d.number),new Paragraph("Bill to: "+d.customer_name),new Paragraph(d.customer_email||""),...items.map(it=>new Paragraph(`${it.description} — ${it.quantity} × ${Number(it.unitPrice).toFixed(2)} ${d.currency}`)),new Paragraph({children:[new TextRun({text:"Total: "+Number(d.total).toFixed(2)+" "+d.currency,bold:true})]}),new Paragraph(d.notes||"")];
  const buffer=await Packer.toBuffer(new Document({sections:[{children}]}));res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.wordprocessingml.document");res.setHeader("Content-Disposition",`attachment; filename="${safeName}.docx"`);return res.send(buffer);
 }
 res.status(400).json({error:"Format must be pdf or docx."});
});

app.post("/api/track",async(req,res)=>{
 const trackingNumber=clean(req.body?.trackingNumber,80),carrier=clean(req.body?.carrier,80).toLowerCase();
 const apiUrl=process.env.KARRIO_API_URL?.replace(/\/+$/,""),apiKey=process.env.KARRIO_API_KEY;
 if(!apiUrl||!apiKey)return res.status(503).json({error:"Live carrier tracking has not been connected yet.",code:"TRACKING_NOT_CONFIGURED"});
 if(trackingNumber.length<4)return res.status(400).json({error:"Enter a valid tracking reference."});
 const headers={Authorization:"Token "+apiKey,Accept:"application/json","Content-Type":"application/json"};
 try{
  let r=await fetch(apiUrl+"/v1/trackers/"+encodeURIComponent(trackingNumber),{headers,signal:AbortSignal.timeout(12000)});
  if(!r.ok&&[400,404].includes(r.status)){
   if(!carrier)return res.status(409).json({needsCarrier:true,message:"Select the carrier shown on your shipping receipt."});
   r=await fetch(apiUrl+"/v1/trackers",{method:"POST",headers,body:JSON.stringify({tracking_number:trackingNumber,carrier_name:carrier}),signal:AbortSignal.timeout(18000)});
  }
  const payload=await r.json().catch(()=>({}));if(!r.ok)return res.status(422).json({error:payload.detail||payload.message||"The carrier could not locate this shipment."});
  const t=payload;return res.json({tracker:{id:t.id,trackingNumber:t.tracking_number,carrier:t.carrier_name,carrierName:t.carrier_id||t.carrier_name,status:t.status||"unknown",delivered:Boolean(t.delivered),estimatedDelivery:t.estimated_delivery||t.info?.expected_delivery||null,info:t.info||{},events:Array.isArray(t.events)?t.events.map(e=>({date:e.date||null,time:e.time||null,description:e.description||e.code||"Shipment update",location:e.location||null,code:e.code||null,latitude:Number.isFinite(Number(e.latitude))?Number(e.latitude):null,longitude:Number.isFinite(Number(e.longitude))?Number(e.longitude):null})):[],source:t.info?.source||"Carrier tracking network",testMode:Boolean(t.test_mode)}});
 }catch(error){console.error("Carrier tracking error",error);res.status(502).json({error:"Carrier tracking is temporarily unavailable."});}
});

app.get("*",(req,res)=>{
 const host=req.hostname.toLowerCase();
 if(ADMIN_HOST && host===ADMIN_HOST) return res.sendFile(path.join(__dirname,"dist/admin.html"));
 if(host.startsWith("admin.")) return res.sendFile(path.join(__dirname,"dist/admin.html"));
 if(req.path==="/admin"||req.path.startsWith("/admin/")||req.path==="/admin.html") return res.status(404).send("Not found");
 res.sendFile(path.join(__dirname,"dist/index.html"));
});

await initDatabase();
app.listen(PORT,"0.0.0.0",()=>console.log(`AeroSwift listening on ${PORT}`));
