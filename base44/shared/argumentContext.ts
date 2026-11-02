// Shared prompt blocks for the argument preparation stages.

export function buildEvidenceCorpus(files, maxFiles = 20, maxFileChars = 6000, maxTotalChars = 40000) {
  let total = 0;
  const blocks: string[] = [];

  for (const file of files.slice(0, maxFiles)) {
    if (total >= maxTotalChars) break;
    const text = String(file.text || '').slice(0, Math.min(maxFileChars, maxTotalChars - total));
    if (!text.trim()) continue;
    total += text.length;
    blocks.push(`### Document: ${file.file_name} (${file.category || 'Document'})\n"""\n${text}\n"""`);
  }

  return { corpus: blocks.join('\n\n'), count: blocks.length };
}

export function buildOurPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  const lines = points.slice(0, 40).map((point) => {
    const reference = point.document_name && point.paragraph_ref
      ? `[Document: ${point.document_name}, ${point.paragraph_ref}]`
      : '[USER STATEMENT - NO DOCUMENT REFERENCE]';
    return `- ${point.text || 'point with no text'} ${reference}`;
  });
  return `\n\n## OUR POINTS\n${lines.join('\n')}`;
}

export function buildClauses(clauses) {
  if (!Array.isArray(clauses) || clauses.length === 0) return '';
  const lines = clauses.slice(0, 30).map((clause) => {
    const where = clause.document_name ? `Document: ${clause.document_name}` : 'Document: NOT RECORDED';
    const check = clause.checked ? 'checked against the document' : 'NOT CHECKED against the document';
    return `- ${clause.reference || 'no clause reference'}: "${clause.text || ''}" (${where}; ${check})`;
  });
  return `\n\n## CONTRACT CLAUSES AND RULES RELIED ON\n${lines.join('\n')}`;
}

export function buildMisstatements(misstatements) {
  if (!Array.isArray(misstatements) || misstatements.length === 0) return '';
  const lines = misstatements.slice(0, 30).map((entry) => {
    const where = entry.document_name
      ? `Supporting document: ${entry.document_name}${entry.paragraph_ref ? `, ${entry.paragraph_ref}` : ''}`
      : 'Supporting document: NONE';
    return `- They say: ${entry.statement || ''}\n  Our position: ${entry.correct_position || 'not stated'}\n  ${where}`;
  });
  return `\n\n## MISSTATEMENTS BY THE OTHER SIDE\n${lines.join('\n')}`;
}

export function buildAnswers(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return '';
  const answered = questions.filter((question) => question.answer || question.status);
  if (answered.length === 0) return '';

  const lines = answered.slice(0, 30).map((question) => {
    const answer = question.status === 'Dont know'
      ? 'DON\'T KNOW'
      : question.status === 'Skipped'
        ? 'SKIPPED - no answer'
        : question.answer || 'no answer';
    const extras = [
      question.quote ? `Quote given: "${question.quote}"` : '',
      question.document_name ? `Attached document: ${question.document_name}` : '',
      question.conflict_resolution ? `Conflict resolved in favour of: ${question.conflict_resolution}` : '',
    ].filter(Boolean);
    return `Q: ${question.question}\nA: ${answer}${extras.length ? `\n   (${extras.join('; ')})` : ''}`;
  });

  return `\n\n## ANSWERS TO THE PREPARATION QUESTIONS\n${lines.join('\n')}`;
}

export function buildExtracts(extracts, caseLaw) {
  if (!Array.isArray(extracts) || extracts.length === 0) return '';
  const byId = new Map((caseLaw || []).map((record) => [record.id, record]));

  const lines = extracts.slice(0, 60).map((extract) => {
    const record = byId.get(extract.case_law_id) || {};
    const checked = record.check_status === 'Extract checked against official text'
      ? 'checked'
      : 'NOT CHECKED';
    return `- ${record.name || 'unnamed authority'} ${record.neutral_citation || ''} at ${extract.paragraph_ref || 'no paragraph reference'} (${checked})\n  EXACT TEXT: ${String(extract.extract_text || '').slice(0, 1200)}\n  Proposition: ${extract.proposition || 'not stated'}`;
  });

  return `\n\n## CASE LAW LIBRARY EXTRACTS (the only quotable authority wording)\n${lines.join('\n')}`;
}