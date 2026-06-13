# TACT-CRM

מערכת CRM רב-דיירית (multi-tenant). כל **חברה** מנהלת את הלקוחות שלה ורואה רק את הנתונים שלה.
**לקוח** הוא זהות גלובלית שיכולה להשתייך ליותר מחברה אחת, וכל חברה מסווגת אותו בעזרת **שדות
מותאמים-אישית** משלה — בנוסף לפרטים הרגילים (מייל, טלפון וכו'). מנהלים בלבד. תמיכה ב-API דרך
מפתחות פר-חברה.

## הרצה מהירה (PowerShell)

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
.\backend\.venv\Scripts\python.exe database\seed.py      # זריעה -> database\tactcrm.db
cd backend
..\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8010

# Frontend (חלון נפרד)
cd frontend
npm install
npm run dev
```

פתחו http://localhost:5200 · תיעוד API: http://localhost:8010/docs

### התחברות (dev-login, ללא סיסמה)
| מייל | תפקיד |
|---|---|
| `root@tact-crm.io` | מנהל-על |
| `admin@demo.co.il` / `user@demo.co.il` | חברת דמו |
| `admin@bnb.co.il` / `user@bnb.co.il` | ב.נ.ב שיווק |

הדאטה הראשונית כוללת לקוחה אחת המשויכת לשתי החברות עם סיווגים שונים בכל אחת.

## ארכיטקטורה
ראו [CLAUDE.md](CLAUDE.md) — מבנה הנתונים (זהות גלובלית + שיוך M:N), שכבות ה-backend, בידוד
דיירים, התפקידים, ומשטחי ה-API.

## דוגמת שימוש ב-API התכנותי
```bash
# החליפו <KEY> במפתח שנוצר במסך "מפתחות API"
curl -H "X-API-Key: <KEY>" http://localhost:8000/api/v1/customers
curl -X POST -H "X-API-Key: <KEY>" -H "Content-Type: application/json" \
  -d '{"full_name":"לקוח חדש","email":"x@example.com","fields":{"status":"ליד"}}' \
  http://localhost:8000/api/v1/customers
```

## מבנה
```
database/  קובץ ה-DB, schema.sql, seed.py, README   ← כל ענייני בסיס הנתונים
backend/   FastAPI · SQLAlchemy · SQLite(dev)/Postgres(prod)
  app/{models,schemas,services,api,auth}  config.py deps.py main.py
frontend/  React · Vite · TS · Tailwind · TACT design
  src/{pages,components,lib,styles}
```
