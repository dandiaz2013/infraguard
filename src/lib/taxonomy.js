// JurisAI taxonomy.
// Add a new domain by appending one object to TAXONOMY - nothing else in the app
// needs to change; every dropdown and label reads from this file.

export const CONTEXT_TYPES = [
  { value: 'limitation', label: 'Limitation' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'duty', label: 'Duty' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'causation', label: 'Causation' },
  { value: 'remedy', label: 'Remedy' },
  { value: 'standard_of_review', label: 'Standard of review' },
  { value: 'other', label: 'Other' },
];

export const TAXONOMY = [
  {
    id: 'commercial-disputes',
    name: 'Commercial Disputes',
    relationships: [
      { id: 'b2b', name: 'B2B' },
      { id: 'shareholder-director', name: 'Shareholder/Director' },
      { id: 'partnership', name: 'Partnership' },
    ],
    groups: [
      {
        id: 'formation-validity',
        name: 'Formation & Validity',
        issues: [
          { id: 'comm-offer-acceptance', name: 'Offer and acceptance' },
          { id: 'comm-consideration', name: 'Consideration' },
          { id: 'comm-intention', name: 'Intention to create legal relations' },
          { id: 'comm-certainty', name: 'Certainty of terms' },
          { id: 'comm-misrepresentation', name: 'Misrepresentation' },
          { id: 'comm-duress', name: 'Duress and undue influence' },
          { id: 'comm-capacity', name: 'Capacity' },
          { id: 'comm-illegality', name: 'Illegality' },
        ],
      },
      {
        id: 'terms-of-contract',
        name: 'Terms of Contract',
        issues: [
          { id: 'comm-express-terms', name: 'Express terms' },
          { id: 'comm-implied-terms', name: 'Implied terms' },
          { id: 'comm-incorporation', name: 'Incorporation of terms' },
          { id: 'comm-construction', name: 'Interpretation of terms' },
          { id: 'comm-exclusion', name: 'Exclusion and limitation clauses' },
          { id: 'comm-unfair-terms', name: 'Unfair terms' },
          { id: 'comm-variation', name: 'Variation of contract' },
        ],
      },
      {
        id: 'breach',
        name: 'Breach',
        issues: [
          { id: 'comm-breach-express', name: 'Breach of express term' },
          { id: 'comm-breach-implied', name: 'Breach of implied term' },
          { id: 'comm-anticipatory-breach', name: 'Anticipatory breach' },
          { id: 'comm-repudiatory-breach', name: 'Repudiatory breach' },
          { id: 'comm-defective-performance', name: 'Defective performance' },
          { id: 'comm-late-performance', name: 'Late performance' },
          { id: 'comm-failure-to-pay', name: 'Failure to pay' },
        ],
      },
    ],
  },
  {
    id: 'construction-engineering',
    name: 'Construction & Engineering',
    relationships: [
      { id: 'employer-main-contractor', name: 'Employer-Main Contractor' },
      { id: 'main-contractor-subcontractor', name: 'Main Contractor-Subcontractor' },
    ],
    groups: [
      {
        id: 'defects',
        name: 'Defects',
        issues: [
          { id: 'con-design-defects', name: 'Design defects' },
          { id: 'con-workmanship-defects', name: 'Workmanship defects' },
          { id: 'con-latent-defects', name: 'Latent defects' },
          { id: 'con-patent-defects', name: 'Patent defects' },
          { id: 'con-defective-materials', name: 'Defective materials' },
          { id: 'con-specification', name: 'Failure to comply with specification' },
          { id: 'con-snagging', name: 'Snagging items' },
        ],
      },
      {
        id: 'delay-disruption',
        name: 'Delay & Disruption',
        issues: [
          { id: 'con-extension-of-time', name: 'Extension of time' },
          { id: 'con-liquidated-damages', name: 'Liquidated damages' },
          { id: 'con-concurrent-delay', name: 'Concurrent delay' },
          { id: 'con-variations-delay', name: 'Delay caused by variations' },
          { id: 'con-loss-of-productivity', name: 'Disruption and loss of productivity' },
          { id: 'con-acceleration', name: 'Acceleration' },
          { id: 'con-time-at-large', name: 'Time at large' },
        ],
      },
    ],
  },
];

export function getDomain(domainId) {
  return TAXONOMY.find((domain) => domain.id === domainId) || null;
}

export function getRelationship(domainId, relationshipId) {
  const domain = getDomain(domainId);
  if (!domain) return null;
  return domain.relationships.find((relationship) => relationship.id === relationshipId) || null;
}

export function getIssuesForDomain(domainId) {
  const domain = getDomain(domainId);
  if (!domain) return [];
  return domain.groups.map((group) => ({
    id: group.id,
    name: group.name,
    issues: group.issues,
  }));
}

export function getAllIssues(domainId) {
  const domain = getDomain(domainId);
  if (!domain) return [];
  return domain.groups.flatMap((group) =>
    group.issues.map((issue) => ({ ...issue, group_id: group.id, group_name: group.name }))
  );
}

export function getIssue(domainId, issueId) {
  return getAllIssues(domainId).find((issue) => issue.id === issueId) || null;
}

export function issueLabel(domainId, issueId) {
  const issue = getIssue(domainId, issueId);
  return issue ? issue.name : '';
}

export function contextTypeLabel(value) {
  const found = CONTEXT_TYPES.find((type) => type.value === value);
  return found ? found.label : 'Other';
}