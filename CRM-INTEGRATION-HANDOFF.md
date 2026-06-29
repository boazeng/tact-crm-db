# הנחיות לסוכן CRM-DB — אינטגרציית "סוד-שירות" מול אפליקציית bedek

> מסמך העברה (handoff) בין שני ריפו: **tact-crm-db** ↔ **tact-bedek**.
> גישת אימות מוסכמת: **סוד-שירות** (service key) — לא API key פר-חברה.

## הקשר
אפליקציית **bedek** (ניהול ליקויי בנייה) צריכה לקרוא מ-CRM, **לכל חברה בנפרד**, את:
- **פרויקטי הנדל״ן (בדק)** של החברה
- **הלקוחות** של החברה

האימות: **סוד-שירות אחד** (first-party), בכותרת `X-Service-Key`, כשהחברה נבחרת דרך פרמטר `company_id`. **read-only בלבד** — bedek לא כותב שום דבר ל-CRM.

---

## ⚠️ מה כבר נכתב בריפו (טיוטה — נכתבה ע״י סוכן bedek, לא דופלקה, לא commit)
יש כבר שינויים לא-מקומיטים ב-CRM שמממשים את כל זה. אנא **סקור, אמץ והתאם לקונבנציות שלך**:

- `backend/app/config.py` — נוסף setting `service_api_key: str = ""` (ריק = המשטח כבוי)
- `backend/app/deps.py` — נוספה תלות `get_service_company` (בודקת `X-Service-Key` עם `secrets.compare_digest`, דורשת `company_id`)
- `backend/app/api/service.py` — ראוטר חדש `/api/service`
- `backend/app/main.py` — רישום הראוטר

נבדק מקומית עם TestClient: `401` בלי/מפתח-שגוי, `200` עם הנכון, `400` בלי `company_id`. ✓

---

## 🔒 חוזה ה-API (קריטי — bedek מסתמך על זה בדיוק, אל תשנה בלי לתאם)
כל הקריאות: header `X-Service-Key: <SECRET>` + query `company_id=<int>`

| Endpoint | מחזיר |
|---|---|
| `GET /api/service/company` | `{ "id": int, "name": str }` (whoami לאישור הקישור) |
| `GET /api/service/realestate-projects` | רשימת `RealEstateProjectOut` |
| `GET /api/service/customers` | רשימת `CustomerOut` |

שגיאות: `401` (מפתח חסר/שגוי או משטח כבוי) · `400` (חסר `company_id`) · `404` (חברה לא קיימת/לא פעילה).

**שדות עיקריים ב-`RealEstateProjectOut`:**
`id, company_id, project_number, name, description, customer_membership_id, customer_name, notes, creation_date, params[], numbers[], flags[], lists[], created_at, updated_at`

**שדות עיקריים ב-`CustomerOut`:**
`membership_id, id, full_name, customer_type, company_name, national_id, phone, email, status, source, external_ref, ...`

---

## ✅ המשימות שלך (צד CRM)
1. **סוד-שירות בפרוד:** לייצר ערך אקראי חזק (≥32 bytes), ולהזריק אותו כמשתנה סביבה `SERVICE_API_KEY` ל-Lambda (דרך ה-SAM template / Secrets Manager / SSM Parameter — לא בקוד, לא ב-git).
2. **החלטת סינון "בדק":** כרגע `/realestate-projects` מחזיר את **כל** פרויקטי הנדל״ן של החברה. אם יש שדה ב-CRM שמסמן פרויקט כ"בדק" (למשל `list3 == "בדק"`) — הוסף סינון ועדכן איזה שדה+ערך. אם כל פרויקטי הנדל״ן = בדק → השאר כמו שהוא.
3. **דיפלוי:** push → CI/CD, ולוודא שהמשטח חי בפרוד.
4. **בדיקת עשן בפרוד:**
   ```bash
   curl -H "X-Service-Key: <SECRET>" "https://<CRM_BASE_URL>/api/service/company?company_id=1"
   ```

---

## 📤 מה להחזיר לסוכן bedek (כדי שימשיך לצד bedek)
1. **ה-base URL של CRM בפרוד** (כתובת ה-API, למשל `https://xxxx.cloudfront.net` או execute-api).
2. **ערך ה-`SERVICE_API_KEY`** (איך תעביר בבטחה — bedek יאחסן אותו ב-Secrets Manager/env, לעולם לא ב-frontend).
3. **החלטת הסינון "בדק"** (כל הנדל״ן / שדה ספציפי + ערך).
4. **דוגמת JSON אמיתית אחת** של `realestate-project` ושל `customer` מהפרוד — כדי שאמפה נכון את השדות לטבלאות של bedek.

---

## מה יקרה אח״כ בצד bedek (שלב 2, לידיעה)
- שמירת ה-CRM base URL + הסוד בצד-שרת (Secrets Manager/env), לא חשוף ב-UI.
- קישור חד-פעמי: חברה ב-bedek ↔ `company_id` ב-CRM.
- שירות סנכרון שמייבא פרויקטים + לקוחות (read-only), עם כפתור "סנכרון מ-CRM".

---

## ✅ צד CRM הושלם — תשובות ל-bedek (2026-06-29)
המשטח חי בפרוד ונבדק. עבר בדיקת עשן: `401` ללא/מפתח-שגוי · `400` ללא `company_id` · `200` עם מפתח+`company_id`.

1. **CRM base URL (פרוד):** `https://crm-db.newavera.co.il` (חלופה ישירה: `https://d2tbaitn7urlvp.cloudfront.net`). הנתיבים תחת `/api/service/...`.
2. **SERVICE_API_KEY:** מאוחסן ב-AWS SSM Parameter Store (אותו חשבון, us-east-1) בשם **`tact-crm-service-key`** (SecureString). bedek יקרא אותו משם / יזריק ל-Secrets Manager שלו. **לא נשמר ב-git.**
3. **סינון "בדק":** קטגוריית פרויקטי הנדל״ן ב-CRM היא בדיוק "פרויקטים בנדלן בדק" → `GET /api/service/realestate-projects` כבר מחזיר רק פרויקטי בדק. אין סינון נוסף.
4. **מיפוי tenant לבדיקה:** `company_id=1` = "קבוצה אורבנית" (951 לקוחות, 0 פרויקטי נדל״ן) · `company_id=2` יש בה פרויקט נדל״ן לדוגמה.

**דוגמת `realestate-project` (company_id=2):** שדות מאוכלסים — `id, company_id, project_number ("106"), name ("יצחק שמיר 11"), description, customer_membership_id, customer_name, notes, creation_date ("2026-06-15"), params[15], numbers[15], flags[5], lists[10], created_at, updated_at`.

**דוגמת `customer` (company_id=1):** `membership_id, id, status, source ("sync"), external_ref ("50658"), is_paying, paid_by_membership_id, paid_by_name, links[], customer_number, full_name, customer_type ("person"), company_name, national_id, nickname, role, street1/city1/street2/city2, phone, email, allow_mailing, notes, creation_date, params[15], numbers[15], flags[5], lists[10], fields{}, created_at, updated_at`.
