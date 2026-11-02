// Promptness, measured from the record: the date of the order challenged to the date
// the application was filed. No fixed period is ever stated.
import { dateFromDocument, formatDate, daysBetween, intervalText, toIsoDate } from '@/lib/documentDate';
import { storedExtractFor } from '@/lib/evidence';
import { clip } from '@/lib/recordIndex';

export function ordersInRecord(record) {
  return (record?.documents || [])
    .filter((doc) => doc.category === 'Orders')
    .map((doc) => {
      const dated =
        doc.doc_date ||
        doc.filed_date ||
        dateFromDocument(doc.text, 'Orders') ||
        toIsoDate((doc.text.match(/\b(?:DATED|dated)\s*:?\s*([^\n]{6,30})/) || [])[1] || '');
      const segment =
        (doc.segments || []).find((entry) => /IT IS (HEREBY )?(ORDERED|DIRECTED)|ORDER\b/i.test(entry.text)) ||
        (doc.segments || [])[0];
      return {
        id: doc.id,
        name: doc.name,
        date: dated || '',
        date_text: formatDate(dated) || 'date not found in the document',
        ref: segment?.ref || '',
        quote: clip(segment?.text || '', 200)
      };
    });
}

export function applicationInRecord(record) {
  const doc = (record?.documents || []).find((entry) => entry.category === 'Application notices');
  if (!doc) return null;
  const dated = doc.doc_date || doc.filed_date || dateFromDocument(doc.text, 'Application notices');
  const segment =
    (doc.segments || []).find((entry) => /\b(I|we) (apply|seek)\b|\bapplication (is made|to)\b/i.test(entry.text)) ||
    (doc.segments || [])[0];
  return {
    id: doc.id,
    name: doc.name,
    date: dated || '',
    date_text: formatDate(dated) || 'date not found in the document',
    ref: segment?.ref || '',
    quote: clip(segment?.text || '', 200)
  };
}

export function promptnessFor({ record, orderId = '', extracts = [] }) {
  const orders = ordersInRecord(record);
  const chosen = orders.find((order) => order.id === orderId) || orders[0] || null;
  const application = applicationInRecord(record);
  const days =
    chosen?.date && application?.date && application.date >= chosen.date
      ? daysBetween(chosen.date, application.date)
      : null;

  const authority = storedExtractFor(extracts, /prompt|delay|out of time|time limit/i);

  const explanation = chosen
    ? (record?.documents || []).some((doc) => doc.role === 'Our side' && doc.category !== 'Orders')
    : false;

  const note = chosen && application
    ? `The order challenged is dated ${chosen.date_text} (${chosen.name}, ${chosen.ref}). The application is dated ${application.date_text} (${application.name}, ${application.ref}). That is ${days === null ? 'an interval that cannot be measured from the dates in the record' : intervalText(days)} between them. Promptness is judged on all the circumstances, not against a fixed period.${authority ? ` Stored extract: “${authority.quote}” (para ${authority.paragraph_ref || 'not recorded'}).` : ''}`
    : 'The record does not show both the order challenged and the application, each with its date, so the interval cannot be measured yet.';

  return { orders, order: chosen, application, days, interval: days === null ? '' : intervalText(days), note, authority, has_explanation: explanation };
}