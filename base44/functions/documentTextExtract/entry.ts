import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUri = typeof body.fileUri === 'string' ? body.fileUri.trim() : '';
    if (!fileUri) return Response.json({ error: 'fileUri is required' }, { status: 400 });

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

    return Response.json({ text: extracted.output?.full_text || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});