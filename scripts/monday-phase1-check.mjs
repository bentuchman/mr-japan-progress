// בדיקת שלב 1 מול BENS WORKSPACE האמיתי — להרצה *מקומית בלבד*, על מכונה
// עם גישה ל-hook.eu2.make.com (סביבת הפיתוח המרוחקת חסומה לרשת).
//
//   BENS_WORKSPACE_URL="https://hook.eu2.make.com/..." \
//   node --experimental-strip-types scripts/monday-phase1-check.mjs <clientMondayItemId>
//
// קריאה בלבד. הפלט מצונזר בכוונה: הסקריפט לעולם אינו מדפיס כתובות,
// שמות או ערכים — רק אילו שדות קיימים ומה סטטוסי התשלום.
const endpoint = process.env.BENS_WORKSPACE_URL;
const itemId = process.argv[2];
if (!endpoint || !itemId) {
  console.error('שימוש: BENS_WORKSPACE_URL=... node --experimental-strip-types scripts/monday-phase1-check.mjs <clientMondayItemId>');
  process.exit(1);
}

const { configureMondayGateway } = await import('../src/monday/gateway.ts');
const { getCustomerJourneyData } = await import('../src/monday/customerJourneyData.ts');

configureMondayGateway({ endpoint });
const r = await getCustomerJourneyData(itemId);

if (!r.ok) {
  console.log('כשל:', JSON.stringify(r.error));
  process.exit(2);
}
const d = r.data;
const has = (v) => (v === null ? '—' : '✓ קיים');
console.log('client item        :', d.clientMondayItemId === itemId ? '✓ נמצא' : d.clientMondayItemId);
console.log('payments item      :', d.paymentsMondayItemId ? '✓ מקושר' : '— אין קישור');
console.log('trip.startDate     :', d.trip.startDate ?? '—');
console.log('trip.endDate       :', d.trip.endDate ?? '—');
console.log('trip.createdAt     :', d.trip.createdAt ?? '—');
console.log('ops.internalStatus :', d.operations.internalStatus ?? '—');
console.log('ops.hotelsBooked   :', d.operations.hotelsBooked === null ? '— לא ידוע' : d.operations.hotelsBooked);
console.log('ops.attractionsRes :', d.operations.attractionsReservationsStatus ?? '—');
console.log('meeting.scheduledAt:', d.meeting.scheduledAt ?? '—');
console.log('meeting.zoomId     :', has(d.meeting.zoomMeetingId));
console.log('meeting.meetingUrl :', has(d.meeting.meetingUrl));
console.log('meeting.reschedule :', has(d.meeting.rescheduleUrl), '| master:', has(d.meeting.rescheduleUrlMaster));
console.log('forms.hotels       :', has(d.forms.hotelSelectionUrl));
console.log('forms.planChanges  :', has(d.forms.planChangesUrl));
console.log('forms.feedback     :', has(d.forms.feedbackUrl));
console.log('service            : status =', d.payments.service.status ?? '—',
            '| link', has(d.payments.service.paymentUrl), '| paidAt', d.payments.service.paidAt ?? '—',
            '| receipt', has(d.payments.service.receiptUrl));
console.log('attractions        : status =', d.payments.attractions.status ?? '—',
            '| link', has(d.payments.attractions.paymentUrl), '| paidAt', d.payments.attractions.paidAt ?? '—',
            '| receipt', has(d.payments.attractions.receiptUrl));
