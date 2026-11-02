import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    case_information: {
      type: 'object',
      properties: {
        case_name: { type: 'string' },
        citation: { type: 'string' },
        court: { type: 'string' },
        judges: { type: 'array', items: { type: 'string' } },
        date: { type: 'string' },
      },
    },
    issues_decided: { type: 'array', items: { type: 'string' } },
    issues_not_decided: { type: 'array', items: { type: 'string' } },
    errors_of_law: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          correct_position: { type: 'string' },
          supporting_authority: { type: 'string' },
          impact: { type: 'string' },
          strength: { type: 'string', enum: ['Strong', 'Moderate', 'Weak'] },
        },
      },
    },
    errors_of_fact: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          finding: { type: 'string' },
          problem: { type: 'string' },
          evidence_issue: { type: 'string' },
        },
      },
    },
    procedural_irregularities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          irregularity: { type: 'string' },
          rule_breached: { type: 'string' },
          impact: { type: 'string' },
        },
      },
    },
    misapplied_authorities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case_name: { type: 'string' },
          citation: { type: 'string' },
          how_misapplied: { type: 'string' },
          correct_application: { type: 'string' },
        },
      },
    },
    counter_authorities_ignored: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case_name: { type: 'string' },
          citation: { type: 'string' },
          why_relevant: { type: 'string' },
          impact_if_considered: { type: 'string' },
        },
      },
    },
    reasoning_weaknesses: { type: 'array', items: { type: 'string' } },
    clear_points_to_raise: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          point_number: { type: 'number' },
          specific_error: { type: 'string' },
          why_it_matters: { type: 'string' },
          remedy_sought: { type: 'string' },
        },
      },
    },
    strategic_recommendations: {
      type: 'object',
      properties: {
        should_appeal: { type: 'string' },
        best_grounds: { type: 'array', items: { type: 'string' } },
        alternative_remedies: { type: 'array', items: { type: 'string' } },
        risk_assessment: { type: 'string' },
      },
    },
    executive_summary: { type: 'string' },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const judgmentText = typeof body.judgmentText === 'string' ? body.judgmentText.trim() : '';
    if (!judgmentText) return Response.json({ error: 'judgmentText is required' }, { status: 400 });

    const prompt = `You are JurisAI - a UK legal expert performing CRITICAL ANALYSIS of a court judgment. This is NOT a summary - this is STRATEGIC LITIGATION ANALYSIS.

## JUDGMENT TEXT
${judgmentText}

## YOUR TASK - CRITICAL ANALYSIS FOR LITIGATION

Analyze this judgment for ERRORS, WEAKNESSES, and APPEAL GROUNDS.

### 1. CASE INFORMATION
   - Case name, citation, court, judges, date, parties

### 2. ISSUES DECIDED vs ISSUES NOT DECIDED
   **CRITICAL**: Identify:
   - What issues the court ACTUALLY decided
   - What issues the court FAILED to address
   - What issues were left unresolved
   - Missing findings of fact

### 3. ERRORS OF LAW (APPEAL GROUNDS)
   For EACH error, specify:
   - The specific legal error made
   - What the correct legal position should be
   - Supporting authority showing the error
   - Impact on outcome
   - Strength of appeal point (Strong/Moderate/Weak)

### 4. ERRORS OF FACT (APPEAL GROUNDS)
   - Factual findings NOT supported by evidence
   - Material facts ignored or overlooked
   - Mischaracterization of evidence
   - Impact on reasoning

### 5. PROCEDURAL IRREGULARITIES
   - Breaches of natural justice
   - Failure to follow correct procedure
   - CPR/Practice Direction violations
   - Denial of fair hearing

### 6. MISAPPLICATION OF AUTHORITIES
   For each cited case, analyze:
   - Was it correctly cited?
   - Was it properly applied?
   - Is it still good law?
   - Was it distinguished when it shouldn't be?
   - Were binding authorities ignored?

### 7. COUNTER-AUTHORITIES THE COURT IGNORED
   - Identify binding or persuasive authorities NOT cited
   - Explain why they should have been considered
   - How they would change the outcome

### 8. REASONING WEAKNESSES
   - Logical fallacies
   - Gaps in reasoning
   - Contradictions in judgment
   - Failure to address key arguments

### 9. CLEAR POINTS TO RAISE (ACTIONABLE)
   Create numbered list of SPECIFIC POINTS that should be raised:
   - In appeal grounds
   - In further arguments
   - In response submissions
   Format: "Point 1: [Specific error] - [Why it matters] - [Remedy sought]"

### 10. STRATEGIC RECOMMENDATIONS
   - Should this be appealed? (YES/NO with reasoning)
   - Best appeal grounds (ranked by strength)
   - Alternative remedies
   - Risk assessment

### 11. EXECUTIVE SUMMARY
   Write 4-5 paragraphs:
   - What went wrong in this judgment
   - Key vulnerabilities
   - Recommended action
   - Litigation strategy

CRITICAL: Be direct, specific, and litigation-focused. This analysis is for a lawyer preparing next steps.`;

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: ANALYSIS_SCHEMA,
    });

    return Response.json({ analysis });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});