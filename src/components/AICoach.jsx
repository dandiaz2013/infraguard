import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, AlertTriangle, CheckCircle, MessageCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AICoach({ 
  factPattern, 
  generatedArgument, 
  currentMatter, 
  authorities = [],
  position 
}) {
  const [feedback, setFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const analyzeArgument = async () => {
    if (!factPattern && !generatedArgument) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior UK barrister coaching a junior colleague. Review this legal argument development and provide strategic guidance.

## MATTER CONTEXT
Court: ${currentMatter?.court || 'Not specified'}
Position: ${position}
Matter Type: ${currentMatter?.matter_type || 'N/A'}

## FACT PATTERN
${factPattern || 'No facts provided yet'}

## GENERATED ARGUMENT
${generatedArgument?.full_argument_markdown || 'No argument generated yet'}

## AVAILABLE AUTHORITIES
${authorities.length > 0 ? authorities.map(a => `- ${a.title} (${a.citation})`).join('\n') : 'None linked'}

## YOUR COACHING TASK
Provide Socratic guidance to strengthen this argument:

1. **STRATEGIC QUESTIONS**: Ask 3-5 probing questions that make the lawyer think deeper about:
   - Missing elements of the cause of action
   - Weaknesses in reasoning
   - Counter-arguments not addressed
   - Evidential gaps

2. **PRACTICE DIRECTION COMPLIANCE**: 
   - Check compliance with ${currentMatter?.court || 'court'} practice directions
   - Flag any procedural issues
   - Suggest improvements

3. **LEGAL WEAKNESSES**: Identify:
   - Logical gaps in reasoning
   - Missing legal steps
   - Authority gaps (cases/statutes not cited but should be)
   - Risk areas

4. **STRENGTHS TO LEVERAGE**: What's working well that should be expanded?

5. **IMMEDIATE IMPROVEMENTS**: 3-5 specific, actionable suggestions

6. **COUNTER-ARGUMENTS**: What will the opponent say? How to pre-empt?

Be constructive but challenging. Guide, don't tell. Ask questions that prompt better thinking.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            strategic_questions: {
              type: "array",
              items: { type: "string" }
            },
            practice_direction_check: {
              type: "object",
              properties: {
                compliant: { type: "boolean" },
                issues: { type: "array", items: { type: "string" } },
                suggestions: { type: "array", items: { type: "string" } }
              }
            },
            weaknesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  weakness: { type: "string" },
                  impact: { type: "string", enum: ["Critical", "Moderate", "Minor"] },
                  how_to_fix: { type: "string" }
                }
              }
            },
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            immediate_improvements: {
              type: "array",
              items: { type: "string" }
            },
            opponent_counter_arguments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  counter: { type: "string" },
                  how_to_address: { type: "string" }
                }
              }
            },
            overall_assessment: { type: "string" }
          }
        }
      });

      setFeedback(result);
    } catch (error) {
      console.error('Coach analysis failed:', error);
      alert('Failed to get coaching feedback');
    } finally {
      setIsAnalyzing(false);
    }
  };

  React.useEffect(() => {
    if ((factPattern || generatedArgument) && !feedback) {
      analyzeArgument();
    }
  }, [factPattern, generatedArgument]);

  if (!factPattern && !generatedArgument) {
    return null;
  }

  return (
    <Card className="shadow-md border-l-4 border-l-purple-600">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-600" />
            AI Legal Coach
            {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); analyzeArgument(); }}>
              Refresh Analysis
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="max-h-[600px] overflow-y-auto space-y-4">
          {isAnalyzing && !feedback && (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600" />
              <p className="text-sm">Analyzing your argument...</p>
            </div>
          )}

          {feedback && (
            <>
              {/* Overall Assessment */}
              {feedback.overall_assessment && (
                <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded">
                  <h4 className="font-semibold text-purple-900 mb-2">Overall Assessment</h4>
                  <p className="text-sm text-slate-700">{feedback.overall_assessment}</p>
                </div>
              )}

              {/* Strategic Questions */}
              {feedback.strategic_questions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    Strategic Questions to Consider
                  </h4>
                  <div className="space-y-2">
                    {feedback.strategic_questions.map((q, idx) => (
                      <div key={idx} className="bg-amber-50 border border-amber-200 p-3 rounded">
                        <p className="text-sm text-slate-800">❓ {q}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Practice Direction Check */}
              {feedback.practice_direction_check && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {feedback.practice_direction_check.compliant ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    Practice Direction Compliance
                  </h4>
                  {feedback.practice_direction_check.issues?.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {feedback.practice_direction_check.issues.map((issue, idx) => (
                        <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-2 rounded text-sm text-red-900">
                          ⚠️ {issue}
                        </div>
                      ))}
                    </div>
                  )}
                  {feedback.practice_direction_check.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      {feedback.practice_direction_check.suggestions.map((sugg, idx) => (
                        <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded text-sm text-blue-900">
                          💡 {sugg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Weaknesses */}
              {feedback.weaknesses?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Areas for Improvement
                  </h4>
                  <div className="space-y-3">
                    {feedback.weaknesses.map((w, idx) => (
                      <div key={idx} className="bg-white border rounded p-3">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium text-slate-900">{w.weakness}</p>
                          <Badge className={
                            w.impact === 'Critical' ? 'bg-red-600' :
                            w.impact === 'Moderate' ? 'bg-orange-500' : 'bg-yellow-500'
                          }>{w.impact}</Badge>
                        </div>
                        <p className="text-xs text-green-700">
                          <span className="font-medium">Fix:</span> {w.how_to_fix}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {feedback.strengths?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Strengths to Leverage
                  </h4>
                  <div className="space-y-2">
                    {feedback.strengths.map((s, idx) => (
                      <div key={idx} className="bg-green-50 border-l-4 border-green-500 p-2 rounded text-sm text-green-900">
                        ✓ {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immediate Improvements */}
              {feedback.immediate_improvements?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">🎯 Immediate Action Items</h4>
                  <ol className="space-y-2 list-decimal list-inside">
                    {feedback.immediate_improvements.map((imp, idx) => (
                      <li key={idx} className="text-sm text-slate-800 bg-slate-50 p-2 rounded">
                        {imp}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Counter Arguments */}
              {feedback.opponent_counter_arguments?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">🛡️ Opponent's Likely Counter-Arguments</h4>
                  <div className="space-y-3">
                    {feedback.opponent_counter_arguments.map((c, idx) => (
                      <div key={idx} className="bg-slate-100 rounded p-3">
                        <p className="text-sm font-medium text-red-900 mb-2">
                          Counter: {c.counter}
                        </p>
                        <p className="text-xs text-slate-700">
                          <span className="font-medium text-green-800">Address by:</span> {c.how_to_address}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}