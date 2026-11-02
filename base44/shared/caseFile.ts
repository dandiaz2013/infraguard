// The case file is the record. Every backend function that reads the record
// reads it from the Case File Library through this module.
export function caseFileRecord(doc: any = {}) {
  const party = doc?.party || '';
  return {
    id: doc?.id || '',
    file_name: doc?.file_name || '',
    text: doc?.text || '',
    category: doc?.category || '',
    party,
    filed_by: party === 'Other side' ? 'Other party' : party,
    record_status: doc?.record_status || 'Filed or served',
    filed_date: doc?.document_date || '',
    exhibit_of: doc?.exhibit_of || '',
    case_number: doc?.case_number || '',
  };
}

export async function caseFileDocuments(base44: any, matterId: string, options?: any) {
  if (!matterId) return [];
  const result = options
    ? await base44.entities.CaseFileDocument.filter({ matter_id: matterId }, options)
    : await base44.entities.CaseFileDocument.filter({ matter_id: matterId });
  const items = Array.isArray(result) ? result : result?.items || [];
  return items.map(caseFileRecord);
}