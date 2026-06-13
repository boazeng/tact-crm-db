"""Curated reference for the Priority CUSTOMERS form.

For each known Priority field we keep a short Hebrew description and a
*recommended* CRM target:
  • a concrete system-field key (e.g. ``full_name`` / ``city1``) — high confidence,
  • ``SKIP`` — an internal/duplicate/empty field we recommend NOT ingesting,
  • ``""`` — meaningful but company-specific (a param candidate); we describe it
    but leave the target choice to the user.

Only a subset of the ~117 columns is curated; unknown fields get no hint.
"""

SKIP = "-"  # sentinel target meaning "recommend not to import"

# name -> (hebrew_description, recommended_target)
PRIORITY_FIELD_INFO: dict[str, tuple[str, str]] = {
    # --- identity / name ---
    "CUSTNAME": ("קוד/מספר לקוח ייחודי בפריורטי — מפתח הזיהוי לכפילויות", "customer_number"),
    "CUSTDES": ("שם הלקוח", "full_name"),
    "CUSTDESLONG": ("שם לקוח ארוך/מלא", ""),
    "ECUSTDES": ("שם הלקוח באנגלית", ""),
    "CUST": ("מזהה פנימי אוטומטי של פריורטי (לא לשימוש עסקי)", SKIP),
    # --- status / ownership ---
    "STATDES": ("סטטוס הלקוח בפריורטי (פעיל/לא פעיל)", "status"),
    "INACTIVEFLAG": ("סימון לקוח לא-פעיל", SKIP),
    "OWNERLOGIN": ("מנהל התיק / אחראי הלקוח בפריורטי", ""),
    "CREATEDDATE": ("תאריך הקמת הלקוח בפריורטי", "creation_date"),
    "STATUSDATE": ("תאריך עדכון הסטטוס", SKIP),
    "NSFLAG": ("דגל מערכת פנימי", SKIP),
    # --- contact ---
    "PHONE": ("טלפון", "phone"),
    "FAX": ("פקס", ""),
    "EMAIL": ('כתובת דוא"ל', "email"),
    # --- parent / hierarchy ---
    "MCUSTNAME": ("קוד לקוח-אב (הלקוח הראשי שאליו משויך)", ""),
    "MCUSTDES": ("שם לקוח-אב (למשל ועד הבית הראשי)", ""),
    "PCUSTNAME": ("קוד לקוח משלם", ""),
    "PCUSTDES": ("שם לקוח משלם", ""),
    # --- address ---
    "ADDRESS": ("כתובת — רחוב ומספר", "street1"),
    "ADDRESS2": ("כתובת — שורה שנייה", "street2"),
    "ADDRESS3": ("כתובת — שורה שלישית", SKIP),
    "STATE": ("עיר (בפריורטי שדה העיר נקרא STATE)", "city1"),
    "STATEA": ("עיר — שדה כפול ל-STATE", SKIP),
    "STATECODE": ("קוד עיר", SKIP),
    "STATENAME": ("שם עיר (מטבלת ערים)", SKIP),
    "ZIP": ("מיקוד", ""),
    "COUNTRYNAME": ("מדינה", SKIP),
    "GPSX": ("קו אורך GPS", SKIP),
    "GPSY": ("קו רוחב GPS", SKIP),
    # --- tax / legal ---
    "VATNUM": ("ח.פ / מספר עוסק מורשה — מזהה רשמי", "national_id"),
    "WTAXNUM": ("מספר תיק ניכוי מס במקור", ""),
    "WTAXNUMEXPL": ("קוד הסבר לניכוי מס במקור", SKIP),
    "TAXCODE": ('קוד מע"מ', SKIP),
    "TAXDES": ('סוג מע"מ', SKIP),
    # --- sales / commercial ---
    "AGENTNAME": ("שם הסוכן המשויך", ""),
    "AGENTNAME2": ("שם סוכן משני", ""),
    "TERRITORYDES": ("אזור גאוגרפי / טריטוריה", ""),
    "ZONEDES": ("אזור חלוקה", ""),
    "COMMISSION": ("אחוז עמלה", SKIP),
    "MAX_CREDIT": ("מסגרת אשראי מקסימלית", ""),
    "MAX_OBLIGO": ("מסגרת אובליגו (חשיפה) מקסימלית", ""),
    "OBCODE": ("מטבע ההתחייבות", SKIP),
    "CODE": ("מטבע ברירת מחדל", SKIP),
    "PAYDES": ("תנאי תשלום", ""),
    # --- group / branch ---
    "BRANCHDES": ("סניף/חברה בקבוצה שאליה משויך הלקוח", ""),
    "BRANCHNAME": ("קוד סניף", SKIP),
    # --- notes / free ---
    "CUSTREMARK": ("הערות חופשיות ללקוח", "notes"),
    "BUSINESSTYPE": ("סוג העסק", ""),
    # SPEC1..SPEC20 are Priority's free user-defined fields.
    **{f"SPEC{i}": (f"שדה חופשי SPEC{i} בפריורטי", "") for i in range(1, 21)},
    # --- clearly internal flags we recommend skipping ---
    "EXTFILEFLAG": ("דגל קובץ חיצוני מצורף", SKIP),
    "EDOCUMENTS": ("דגל מסמכים אלקטרוניים", SKIP),
    "HOSTNAME": ("שם מארח (מערכת)", SKIP),
    "CONFIDENTIAL": ("סימון חסוי", SKIP),
    "RECYCLINGFLAG": ("דגל מיחזור", SKIP),
    "BONUSFLAG": ("דגל בונוס", SKIP),
    "COMPETITORFLAG": ("דגל מתחרה", SKIP),
}


def enrich(fields: list[dict]) -> list[dict]:
    """Attach `description` and `suggested` to each discovered field in place."""
    for f in fields:
        desc, target = PRIORITY_FIELD_INFO.get(f["name"], ("", ""))
        f["description"] = desc
        f["suggested"] = target
    return fields
