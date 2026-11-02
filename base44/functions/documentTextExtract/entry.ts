import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MAX_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try {
      user = await base44.auth.me();
    } catch (error) {
      if (error?.status !== 401) throw error;
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    if (!fileName || !fileBase64) {
      return Response.json({ error: 'fileName and fileBase64 are required' }, { status: 400 });
    }

    // This function uploads the document itself, inside the same request that reads it.
    // It never accepts a file reference from the caller, so a signed-in user cannot ask
    // for another user's private file to be opened.
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength === 0) {
      return Response.json({ error: 'The document is empty' }, { status: 400 });
    }
    if (bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: 'Document is too large (maximum 10 MB)' }, { status: 413 });
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const file = new File([bytes], fileName, { type: MIME_BY_EXT[ext] || 'application/octet-stream' });

    const uploaded = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const fileUri = uploaded?.file_uri;
    if (!fileUri) {
      return Response.json({ error: 'Could not store the document' }, { status: 500 });
    }

    if (ext === 'txt') {
      return Response.json({ text: new TextDecoder().decode(bytes), file_uri: fileUri });
    }

    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 600,
    });
    if (!signed?.signed_url) {
      return Response.json({ error: 'Could not open this document' }, { status: 422 });
    }

    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed.signed_url,
      json_schema: {
        type: 'object',
        properties: {
          full_text: { type: 'string' },
        },
      },
    });

    if (extracted?.status !== 'success') {
      return Response.json({ error: extracted?.details || 'Could not read this document' }, { status: 422 });
    }

    return Response.json({ text: extracted.output?.full_text || '', file_uri: fileUri });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});