import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { resolveDocumentRefs } from '@/lib/docReferences';

const STATUS_CLASS = {
  found: 'text-blue-700 decoration-dotted underline cursor-help',
  missing_document: 'text-red-700 underline decoration-wavy cursor-help',
  missing_paragraph: 'text-red-700 underline decoration-wavy cursor-help',
  ambiguous: 'text-amber-700 underline decoration-wavy cursor-help',
};

export default function DraftBody({ text, documents = [], className }) {
  const rows = useMemo(() => resolveDocumentRefs(text, documents), [text, documents]);

  const prepared = useMemo(() => {
    let out = String(text || '');
    rows.forEach((row, index) => {
      const label = row.label.replace(/\[/g, '(').replace(/\]/g, ')');
      out = out.split(row.raw).join(`[${label}](#docref-${index})`);
    });
    return out;
  }, [text, rows]);

  const components = useMemo(
    () => ({
      a: ({ href, children }) => {
        if (typeof href === 'string' && href.startsWith('#docref-')) {
          const row = rows[Number(href.replace('#docref-', ''))];
          if (row) {
            const tip = `${row.statusLabel}${row.text ? `\n${row.text}` : row.detail ? `\n${row.detail}` : ''}`;
            return (
              <span title={tip} className={STATUS_CLASS[row.status] || 'text-slate-700'}>
                {children}
              </span>
            );
          }
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [rows]
  );

  return (
    <div className={className}>
      <ReactMarkdown components={components}>{prepared}</ReactMarkdown>
    </div>
  );
}