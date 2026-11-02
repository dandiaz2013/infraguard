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
      const response = await base44.functions.invoke('argumentCoach', {
        court: currentMatter?.court,
        position,
        matterType: currentMatter?.matter_type,
        factPattern,
        generatedArgument: generatedArgument?.full_argument_markdown,
        authorities: authorities.map((a) => ({ title: a.title, citation: a.citation }))
      });

      setFeedback(response.data.feedback);
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