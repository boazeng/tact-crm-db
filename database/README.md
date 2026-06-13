# database/

הבית של כל מה שקשור לבסיס הנתונים של TACT-CRM.

| קובץ | מה זה |
|---|---|
| `tactcrm.db` | קובץ ה‑SQLite של סביבת הפיתוח. נוצר אוטומטית בהרצה הראשונה / בזריעה. **לא** נכנס ל‑git. |
| `schema.sql` | תצלום מצב של כל ה‑DDL (טבלאות + אינדקסים). **מקור האמת הוא המודלים** ב‑`backend/app/models/` — קובץ זה מתעדכן ידנית אחרי שינוי מודל (ראו למטה). |
| `seed.py` | נתוני התחלה: 2 חברות, שדות סיווג, לקוחות, לקוחה משותפת לשתי החברות, וועד בית שלקוח מקושר אליו ומשולם דרכו. |
| `alembic.ini` + `migrations/` | מיגרציות Alembic — שינויי סכמה מבוקרים **בלי איפוס נתונים** (גם ב‑SQLite, דרך batch). |
| `README.md` | הקובץ הזה. |

## איפה ה‑DB יושב ואיך מגדירים
- מיקום קובץ ה‑SQLite מחושב כ‑**נתיב מוחלט** ב‑`backend/app/config.py`
  (`DB_FILE = <root>/database/tactcrm.db`). לכן לא משנה מאיזו תיקייה מריצים — תמיד אותו DB.
- לייצור: הגדירו `DATABASE_URL` ב‑`.env` ל‑PostgreSQL (RDS); אותו קוד, אותה סכמה.

## פקודות (PowerShell, מתיקיית השורש tact-crm)
```powershell
# זריעה (יוצר את ה-DB אם אינו קיים)
.\backend\.venv\Scripts\python.exe database\seed.py

# איפוס מלא וזריעה מחדש
Remove-Item .\database\tactcrm.db -Force
.\backend\.venv\Scripts\python.exe database\seed.py

# רענון schema.sql מתוך ה-DB הנוכחי
.\backend\.venv\Scripts\python.exe -c "import sqlite3,pathlib; con=sqlite3.connect('database/tactcrm.db'); rows=con.execute(\"select sql from sqlite_master where sql is not null and name not like 'sqlite_%' order by type desc, name\").fetchall(); pathlib.Path('database/schema.sql').write_text(';\n\n'.join(r[0].strip() for r in rows)+';\n', encoding='utf-8')"
```

## מיגרציות (Alembic)
מקור האמת לסכמה הוא המודלים ב‑`backend/app/models/`. שינוי סכמה מתבצע ב‑3 שלבים, **בלי
איבוד נתונים** (גם ב‑SQLite — `env.py` מפעיל `render_as_batch`, שמבצע ALTER ע"י העתקת טבלה):

```powershell
# כל הפקודות רצות מתיקיית database/
cd database
$py = "..\backend\.venv\Scripts\python.exe"

# 1. ערכו מודל ב-backend/app/models/, ואז ייצרו מיגרציה אוטומטית:
& $py -m alembic revision --autogenerate -m "תיאור השינוי"

# 2. בדקו את הקובץ שנוצר ב-migrations/versions/ (upgrade/downgrade)

# 3. החילו על ה-DB:
& $py -m alembic upgrade head      # קדימה
& $py -m alembic downgrade -1      # אחורה (צעד אחד)
& $py -m alembic current           # באיזו רביזיה ה-DB
& $py -m alembic history           # כל ההיסטוריה
```

**התקנה מאפס (DB ריק):** `alembic upgrade head` ואז `python seed.py`.
**DB קיים שכבר נוצר עם create_all:** `alembic stamp head` פעם אחת (מסמן שהוא עדכני).

> `app/main.py` עדיין מריץ `create_all` בעלייה (נוחות פיתוח — יוצר טבלאות חסרות בלבד). זה לא
> מתנגש עם Alembic בשגרה; פשוט אל תריצו `upgrade head` על DB שכבר נבנה ע"י create_all בלי
> `stamp` קודם. בייצור (Postgres) Alembic הוא הסמכות הבלעדית.

## מודל הנתונים בקצרה
זהות לקוח **גלובלית** (`customers`) ↔ שיוך M:N לחברה (`customer_companies`, השורה ברמת הדייר) ↔
שדות סיווג פר‑חברה (`field_definitions` + `customer_field_values`). קשרים בין לקוחות
(`parent_membership_id`, `is_paying`, `paid_by_membership_id`) יושבים על השיוך. הסבר מלא:
`../CLAUDE.md`.
