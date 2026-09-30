# SignalBridge 2.2 — Knowledge Sharing

SignalBridge เชื่อมข่าวกับคลัง Knowledge เพื่อเตรียมอีเมลที่เป็นประโยชน์ต่อธุรกิจลูกค้า ใช้ชื่อเอกสารจากเนื้อหา จำกัด 1–3 รายการ และให้ผู้ขายตรวจขั้นสุดท้าย

**สถานะปัจจุบัน:** Rules + Templates ยังไม่เชื่อม Gemini/Ollama และยังไม่ได้ติดตั้งหรือเปิด Schedule ในบัญชี Google จริง รุ่นนี้จัดชื่อใหม่และเตรียมโค้ดสำหรับ GitHub โดยใช้ข้อมูลตัวอย่างสมมติ

## การติดตั้ง

1. สร้าง Google Sheet สำหรับ SignalBridge แล้วเปิด Extensions → Apps Script ใช้โปรเจกต์แยกจากระบบเก่า
2. สร้าง Script ชื่อ Code, Core, Seed และ HTML ชื่อ Review แล้ววางไฟล์จาก `apps-script/`
3. เปิด Project Settings → Show appsscript.json แล้ววาง manifest ตรวจ Services ให้มี Drive API v3
4. Run `setup` ด้วยบัญชีเจ้าของ อนุญาต Google scopes ที่จำเป็น แล้ว reload Sheet
5. แก้ Settings ให้ชี้ Brand Master และ Drive folder จริง ตั้งชื่อผู้ส่ง ลายเซ็น TH/EN และผู้รับ digest ภายใน
6. แทนที่แบรนด์ Demo Finance / Demo Retail / Demo Health ด้วยข้อมูลจริงหรือเชื่อมชีทกลาง
7. ทดสอบการอ่านเอกสาร หน้าตรวจ และ Gmail Draft จริงก่อนเปิด News / Schedule

ใช้ `Install-Guide.html` เพื่อ copy source ทั้งห้าไฟล์ได้ คู่มือถูกสร้างจาก source รุ่นเดียวกัน ไม่ต้อง deploy Web App สำหรับรุ่นนี้ เพราะเปิด Review ผ่านเมนูของ Sheet

## Brand Master

| Field | วิธีใช้ |
|---|---|
| id | รหัสแบรนด์คงที่ ห้ามซ้ำ |
| brand / aliases | ชื่อแบรนด์และชื่อเรียกอื่น; aliases คั่นด้วย `\|` |
| customer_type | EXISTING → UPSALES; PROSPECT / NEW → NEW_OPPORTUNITY; UNKNOWN → NEEDS_CLASSIFICATION |
| industry | HOSPITAL / AUTO / PROPERTY / RETAIL / FMCG / QSR / FINANCE / APP / BEAUTY / FASHION / OTT / GENERAL |
| contact_name / contact_email | ผู้รับที่ตรวจสอบแล้วสำหรับ customer draft |
| owner / current_media | บริบทผู้ดูแล ไม่ใช้ยืนยันว่าลูกค้าจะซื้อเพิ่ม |

ใช้แท็บ `Brands` หรือกำหนด `brand_sheet_id` และ `brand_sheet_tab` เพื่ออ่านชีทกลาง ชีทต้องมีอย่างน้อย id, brand, customer_type

นำไฟล์แบรนด์ของบริษัทเข้าชีทส่วนตัว ไม่ต้อง commit รายชื่อลูกค้าขึ้น GitHub การมีชื่ออยู่ในรายการไม่ได้ยืนยันว่าเป็นลูกค้าเดิม ต้องกำหนดประเภทจากข้อมูลที่ตรวจแล้ว

แบรนด์นอก Master ใช้ New Opportunity เมื่อระบุชื่อได้จาก InputsV2 หรือ Feed ที่มี brand_hint ตรงกับหัวข่าว รุ่นนี้ไม่เดาแบรนด์ที่หัวข่าวกำกวม

## Settings ที่ต้องตั้ง

| Key | ค่า / ความหมาย |
|---|---|
| sales_name / signature_th / signature_en | ชื่อผู้ส่งและลายเซ็นจริง |
| brand_sheet_id / brand_sheet_tab | ชีทกลาง ถ้าเว้น id จะใช้ Brands |
| credential_root_folder_id | ID โฟลเดอร์ Knowledge จริง; public seed เว้นว่าง |
| news_enabled / watchlist_news_enabled | ตั้ง TRUE เมื่อข้อมูลแบรนด์และแหล่งข่าวพร้อม |
| news_max_age_days | อายุข่าวสูงสุด เริ่มต้น 14 วัน |
| news_fetch_interval_minutes | เริ่มต้น 30 นาที |
| credential_refresh_minutes | เริ่มต้น 60 นาที |
| digest_to | อีเมล Yo / ทีมภายใน คั่นด้วย comma หรือ semicolon ไม่เกิน 10 คน |
| digest_enabled | เริ่มต้น FALSE; ตั้ง TRUE และเปิด Schedule เมื่อทดสอบแล้ว |

Batch size 20 และ poll 5 นาทีเป็นพฤติกรรมคงที่ของโค้ดรุ่นนี้ ค่า seed `digest_batch_size` / `poll_minutes` เป็น metadata ไม่ใช่ตัวปรับ runtime

## Knowledge Library

จัดโฟลเดอร์ Research / Case Study / Industry Overview หรือ Outthere Monthly ได้ Documents เก็บ Summary, Topic, Tags, ชื่อลิงก์ TH/EN, URL, modifiedTime และสถานะอ่าน

เลือกรวม 1–3 รายการตามอุตสาหกรรม Objective และ Signal ไม่บังคับให้ครบ 3 ไม่เลือก URL หรือ topic เดียวกันซ้ำในอีเมลเดียว สามารถแก้ชื่อแสดงบนลิงก์ได้โดยไม่ rename ไฟล์จริงใน Drive

รองรับ Docs / Slides / PDF / PPTX / DOCX / TXT ตัวอ่าน Apps Script จำกัดไฟล์ที่ต้องแปลง 10 MB และข้อความ 40,000 ตัวอักษรต่อไฟล์ เอกสารว่างหรือข้อความเพี้ยนจะถูกพักและไม่เลือกอัตโนมัติ ไฟล์ใหญ่ให้ทำ Docs/Slides หรือ text companion แล้วตรวจ Summary

ก่อนสร้าง Gmail Draft จะตรวจ modifiedTime และสิทธิ์ที่มองเห็นได้อีกครั้ง ผู้ขายต้องยืนยันว่าผู้รับเปิดลิงก์ได้ ระบบไม่เปลี่ยนสิทธิ์แชร์เอง

## Review และอีเมล

ข่าว → จัดประเภทลูกค้า → เลือก Knowledge → สร้าง TH/EN → แก้ข้อความและเอกสาร → เลือกภาษา → ยืนยันเนื้อหาและสิทธิ์ → บันทึก → สร้าง Gmail Draft → ผู้ขายส่งเอง

ลูกค้าใหม่แนะนำตัวและคลัง Knowledge ลูกค้าเดิมใช้ข้อความต่อเนื่องความสัมพันธ์ อีเมลเชื่อมข่าวกับบริบทธุรกิจและชวนแลกเปลี่ยนมุมมอง ไม่ใส่ราคา Inventory หรือแนะนำแพ็กเกจสื่อ

TH/EN แก้แยกกันและยังเก็บข้อความเมื่อสลับภาษา ปุ่มสร้างอีเมลใหม่แทนข้อความทั้งสองภาษา ต้องตรวจใหม่ UNKNOWN และเอกสารที่ยังอ่านไม่ได้จะบล็อก customer draft

## Schedule และกันซ้ำ

ส่งภายในครั้งละ 20 signals ที่ยังไม่ส่ง เฉพาะจันทร์–ศุกร์ 08:30 ≤ เวลาไทย <18:00 ไม่ครบ 20 ให้เก็บรอ และไม่ใช้ข่าวเกิน news_max_age_days มาเติมคิว

Google อาจเรียก Trigger ล่าช้า จึงไม่รับประกันส่งตรงวินาที 08:30 โควตาไม่พอให้พักคิว เมื่อผลส่งไม่แน่นอนจะตรวจ Sent/Draft ก่อนลองอีก

โค้ดปัจจุบันรวมพาดหัวที่เหมือนกันหลัง normalize และเก็บ Signal IDs ที่ส่งแล้ว พาดหัวต่างกันแม้เป็นเหตุการณ์เดียวกันอาจยังเข้าเป็นหลาย signal; การกันซ้ำตามความหมายและ 1 signal ต่อแบรนด์ต่อ batch อยู่ใน [แบบออกแบบ](docs/WORKFLOW.md)

## ข้อมูลและสถานะฟีเจอร์

Public seed มีแบรนด์สมมติ 3 รายการที่เป็น UNKNOWN และไม่มีเอกสารจริง `data/demo.json` ใช้เฉพาะ tests ไม่ใช่คลังที่จะติดตั้ง `Preview.html` เป็น offline demo ไม่เชื่อม Gmail หรือ Google account

อ่าน [Architecture](docs/ARCHITECTURE.md), [Workflow](docs/WORKFLOW.md) และ [Status](docs/STATUS.md) ก่อนเริ่มทำส่วน Hybrid AI ตามที่ออกแบบ รุ่นนี้ไม่มีการเรียก LLM API และไม่มี API key

คงชื่อภายใน RevenueCore, REVENUE_SEED, InputsV2, AuditV2 และ markers RA ไว้เพื่อ compatibility ชื่อที่แสดงต่อผู้ใช้เป็น SignalBridge
