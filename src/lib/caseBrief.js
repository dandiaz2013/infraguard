// The Case Brief: the issue in two lines, our case in five, the gateway lights,
// the next actions and what is missing. All from the record.
import { clip } from '@/lib/recordIndex';

export function buildCaseBrief({ matter, gateway = [], promptness = null, missingDocs = [], dismissed = [], ourPoints = [] }) {
  const order = promptness?.order || null;
  const relief = gateway.find((issue) => issue.id === 'relief');
  const route = gateway.find((issue) => issue.id === 'route');

  const issue = clip(
    [
      `${matter?.matter_type || 'Application'} in ${matter?.court || 'the court of record'}: application to vary, revoke or reopen ${
        order ? `the order dated ${order.date_text}` : 'the order challenged'
      }.`,
      relief?.ours
        ? `Relief sought: “${relief.ours.quote}” (${relief.ours.document_name}, ${relief.ours.ref}).`
        : 'The relief sought is not yet in the record.',
      route?.ours ? '' : 'The rule relied on is not yet in the record.'
    ]
      .filter(Boolean)
      .join(' '),
    300
  );

  const ourCase = [];
  gateway.forEach((item) => {
    if (item.ours && ourCase.length < 5) {
      ourCase.push({
        text: clip(item.ours.quote, 150),
        source: `${item.ours.document_name}, ${item.ours.ref}`,
        issue: item.title,
        rating: item.rating
      });
    }
  });
  ourPoints.forEach((point) => {
    if (ourCase.length < 5 && point.text) {
      ourCase.push({
        text: clip(point.text, 150),
        source: [point.document_name, point.paragraph_ref].filter(Boolean).join(', ') || 'Your entry',
        issue: 'Our point',
        rating: ''
      });
    }
  });

  const missing = [];
  gateway
    .filter((item) => item.rating === 'Weak')
    .forEach((item) => missing.push(`${item.title}: ${item.reason}`));
  missingDocs
    .filter((doc) => !dismissed.includes(doc.id))
    .forEach((doc) => missing.push(`${doc.label} — referred to at ${doc.document_name}, ${doc.ref}`));

  const rank = { Weak: 0, Arguable: 1, Strong: 2 };
  const actions = gateway
    .slice()
    .sort((a, b) => rank[a.rating] - rank[b.rating])
    .map((item) => ({ text: item.next, issue: item.title, rating: item.rating }))
    .slice(0, 5);

  return { issue, ourCase, missing: missing.slice(0, 6), actions, order };
}