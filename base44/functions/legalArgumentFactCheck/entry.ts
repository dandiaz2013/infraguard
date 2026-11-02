import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const argument = typeof body.argument === 'string' ? body.argument.trim() : '';
    const factPattern = typeof body.factPattern === 'string' ? body.factPattern : '';
    if (!argument) return Response.json({ error: 'argument is required' }, { status: 400 });

    const prompt = `You are a UK legal fact-checker. Review the following legal argument and identify any factual inaccuracies, unsupported claims, or errors in legal reasoning.

## Generated Argument
${argument}

## Original Facts
${factPattern}

## Task
1. Identify any factual errors or unsupported claims
2. Check if legal principles are correctly stated
3. Verify case citations if any
4. Flag any logical inconsistencies
5. Provide corrected version if errors found

Return the corrected argument with all factual errors fixed. If no errors, return the original argument with a note that it's accurate.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
    });

    return Response.json({ argument: typeof result === 'string' ? result : JSON.stringify(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});