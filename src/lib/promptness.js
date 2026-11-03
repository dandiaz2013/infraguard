// Promptness, measured from the record: the date of the order challenged to the date
// the application was filed. No fixed period is ever stated. Only dates the user has
// confirmed are used, and both dates are shown with the interval between them.
import {
  confirmedDate,
  detectDocumentDate,
  formatDate,
  daysBetween,
  intervalText
} from '@/lib/documentDate';
import { storedExtractFor } from '@/lib/evidence';
import { clip } from '@/lib/recordIndex';

function dateState(doc, category) {
  const confirmed = confirmedDate(doc);
  if (confirmed) {
    return { date: confirmed, confirmed: true, text: formatDate(confirmed), detected: '' };
  }
  const detected = detectDocumentDate(doc?.text || '', category).date;
  return {
    date: '',
    confirmed: false,
    text: detected ? `Detected: ${formatDate(detected)} - Confirm / Change` : 'date not found in the document',
    detected,
  };
}

export function ordersInRecord(record) {
  return (record?.documents || [])
    .filter((doc) => doc.category === 'Orders')
    .map((doc) => {
      const state = dateState(doc, 'Orders');
      const segment =
        (doc.segments || []).find((entry) => /IT IS (HEREBY )?(ORDERED|DIRECTED)|ORDER\b/i.test(entry.text)) ||
        (doc.segments || [])[0];
      return {
        id: doc.id,
        name: doc.name,
        date: state.date,
        date_confirmed: state.confirmed,
        date_text: state.text,
        detected_date: state.detected,
        ref: segment?.ref || '',
        quote: clip(segment?.text || '', 200)
      };
    });
}

export function applicationInRecord(record) {
  const doc = (record?.documents || []).find((entry) => entry.category === 'Application notices');
  if (!doc) return null;
  const state = dateState(doc, 'Application notices');
  const segment =
    (doc.segments || []).find((entry) => /\b(I|we) (apply|seek)\b|\bapplication (is made|to)\b/i.test(entry.text)) ||
    (doc.segments || [])[0];
  return {
    id: doc.id,
    name: doc.name,
    date: state.date,
    date_confirmed: state.confirmed,
    date_text: state.text,
    detected_date: state.detected,
    ref: segment?.ref || '',
    quote: clip(segment?.text || '', 200)
  };
}

export function promptnessFor({ record, orderId = '', extracts = [] }) {
  const orders = ordersInRecord(record);
  const chosen = orders.find((order) => order.id === orderId) || orders[0] || null;
  const application = applicationInRecord(record);
  const bothConfirmed = Boolean(chosen?.date && application?.date);
  const days =
    bothConfirmed && application.date >= chosen.date ? daysBetween(chosen.date, application.date) : null;

  const authority = storedExtractFor(extracts, /prompt|delay|out of time|time limit/i);

  const note =
    chosen && application
      ? `The order challenged is dated ${chosen.date_text} (${chosen.name}, ${chosen.ref}). The application is dated ${application.date_text} (${application.name}, ${application.ref}). ${
          days === null
            ? 'Both dates must be confirmed before the interval is measured.'
            : `That is ${intervalText(days)} between them.`
        } Promptness is judged on all the circumstances, not against a fixed period.${
          authority
            ? ` Stored extract: “${authority.quote}” (para ${authority.paragraph_ref || 'not recorded'}).`
            : ''
        }`
      : 'The record does not show both the order challenged and the application, each with its date, so the interval cannot be measured yet.';

  return {
    orders,
    order: chosen,
    application,
    days,
    confirmed: days !== null,
    interval: days === null ? '' : intervalText(days),
    note,
    authority
  };
}