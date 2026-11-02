// One place for the extract statuses, the licence line and the safety footer.
export const CHECKED_STATUS = 'Extract checked against official text';
export const PROPOSED_STATUS = 'Proposed - compare with the official text';

export const LICENCE = 'Contains information licensed under the Open Justice Licence v1.0';

export const SAFETY_FOOTER =
  'Draft for review. Check every authority and document reference against the originals before filing. Not legal advice.';

export function isExtractChecked(extract, caseRecord) {
  if (!extract) return false;
  if (extract.status) return extract.status === CHECKED_STATUS;
  // Extracts stored before statuses existed count as checked when the authority was checked.
  return caseRecord?.check_status === CHECKED_STATUS;
}

export function statusLabel(extract, caseRecord) {
  return isExtractChecked(extract, caseRecord) ? 'Checked against the official text' : 'Proposed - compare with the official text';
}