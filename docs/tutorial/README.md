# מדריך שימוש: וידאו ו-HTML

| קובץ | מה זה |
|------|-------|
| [autofill-tutorial.mp4](autofill-tutorial.mp4) | סרטון של כ-4 דקות (1280×800, H.264). התוסף האמיתי באתר מדומה, עם סמן, כתוביות וכרטיסי פרקים |
| [autofill-tutorial.html](autofill-tutorial.html) | נגן אינטראקטיבי בקובץ אחד (עובד גם בלי אינטרנט): 7 פרקים, ניגון/השהיה, קפיצה לשלב, מקלדת (רווח, ←, →), מצב כהה ומובייל |

## הפרקים
1. הוספת מילוי לשדה: קליק ימני, החלון הצמוד לשדה, ערך, שם, «יופיע ב» ושמירה
2. עוד ערך לאותו שדה: כפתור «מילוי חדש» ברשימת ההצעות
3. מילוי בלחיצה: Enter על ההצעה המסומנת, חיצים ועכבר
4. עריכה מתוך הדף: «שמורים לשדה», מתג, עריכה במקום ומחיקה בשתי לחיצות
5. מסך הניהול: פתיחה מהאייקון, סינון לפי אתר, העתקה, עריכה, חיפוש, ומחיקה עם ביטול
6. קיצורי טקסט: הוספה במנהל ושימוש בשדה (@TZ ← מספר הזהות)
7. גיבוי ומצב כהה

## איך זה נוצר
הכל מופק בסקריפט מהתוסף האמיתי (unpacked) ב-Chromium, באתר הבדוי «לומדה» (`lomda.example`), שמוגש מקומית.

- `tests/tutorial/site.html`: האתר המדומה.
- `tests/tutorial/tour-overlay.js`: שכבת ההדגמה שמוזרקת לדפים בזמן ההקלטה: סמן, אפקט לחיצה, כתוביות, כרטיסי פרקים, הדגשה, ותפריט קליק-ימני וסרגל דפדפן מדומים. בדפדפן headless התפריט והסרגל האמיתיים לא מצולמים, ולכן הם מצוירים.
- `tests/tutorial/record.js`: התסריט. במצב `video` הוא מקליט את המסך (CDP screencast) ומקודד MP4 עם ffmpeg. במצב `frames` הוא שומר צילומי מפתח נקיים ו-`steps.json`.
- `tests/tutorial/build-html.js`: בונה את נגן ה-HTML מצילומי המפתח (התמונות, הפונט והלוגו מוטמעים בקובץ).

הפקה מחדש (צריך Playwright, Chromium ו-ffmpeg עם libx264):
```bash
PW=$(npm root -g)/playwright node tests/tutorial/record.js video  /tmp/af-video
PW=$(npm root -g)/playwright node tests/tutorial/record.js frames /tmp/af-frames
node tests/tutorial/build-html.js /tmp/af-frames docs/tutorial/autofill-tutorial.html
cp /tmp/af-video/autofill-tutorial.mp4 docs/tutorial/
```
אחרי שינוי בממשק צריך להריץ מחדש, כי הסרטון מצלם את הקוד הנוכחי.
