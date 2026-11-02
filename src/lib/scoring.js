// Deterministic merits scoring. No AI, no network calls - same answers always
// give the same score.

export const TRIAGE_QUESTIONS = [
  { id: 'limitation', label: 'Claim is within limitation period', points: 20 },
  { id: 'evidence', label: 'Documentary evidence exists to prove the key facts', points: 15 },
  { id: 'quantifiable', label: 'Loss or remedy sought can be quantified', points: 10 },
  { id: 'opponent', label: 'Opponent is identifiable and able to pay', points: 10 },
  { id: 'duty', label: 'A duty or right is established by a recognised authority', points: 15 },
  { id: 'adr', label: 'Alternative dispute resolution has been tried or offered', points: 5 },
  { id: 'agreed_facts', label: 'Key facts are agreed or undisputed', points: 10 },
];

export const ANSWER_OPTIONS = ['Yes', 'No', 'Unsure'];

export const MAX_BASE_SCORE = TRIAGE_QUESTIONS.reduce((total, question) => total + question.points, 0);

export const BAND_STYLES = {
  Poor: 'bg-red-100 text-red-700 border-red-200',
  Speculative: 'bg-orange-100 text-orange-700 border-orange-200',
  Arguable: 'bg-amber-100 text-amber-700 border-amber-200',
  Strong: 'bg-green-100 text-green-700 border-green-200',
};

export function bandForScore(score) {
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Arguable';
  if (score >= 30) return 'Speculative';
  return 'Poor';
}

export function pointsForAnswer(answer, points) {
  if (answer === 'Yes') return points;
  if (answer === 'No') return 0;
  return Math.round(points / 2);
}

export function computeMerits({ answers = {}, usages = [], caseLawById = {} } = {}) {
  const questions = TRIAGE_QUESTIONS.map((question) => {
    const answer = ANSWER_OPTIONS.includes(answers[question.id]) ? answers[question.id] : 'Unsure';
    return {
      id: question.id,
      label: question.label,
      answer,
      max: question.points,
      points: pointsForAnswer(answer, question.points),
    };
  });

  const base_score = questions.reduce((total, question) => total + question.points, 0);

  let supports = 0;
  let against = 0;
  let neutral = 0;
  let unverified = 0;

  usages.forEach((usage) => {
    if (usage.stance === 'neutral') {
      neutral += 1;
      return;
    }
    const authority = caseLawById[usage.case_law_id];
    if (!authority || authority.verified !== true) {
      unverified += 1;
      return;
    }
    if (usage.stance === 'supports') supports += 1;
    if (usage.stance === 'against') against += 1;
  });

  const supports_points = Math.min(supports * 3, 10);
  const against_points = -Math.min(against * 5, 15);
  const adjustment = supports_points + against_points;
  const total = Math.max(0, Math.min(100, base_score + adjustment));

  return {
    questions,
    base_score,
    max_base_score: MAX_BASE_SCORE,
    case_law: {
      supports,
      against,
      neutral,
      unverified,
      supports_points,
      against_points,
      adjustment,
    },
    total,
    band: bandForScore(total),
  };
}

export function explainScore(breakdown) {
  if (!breakdown || !Array.isArray(breakdown.questions)) return [];
  const lines = [];
  const caseLaw = breakdown.case_law || {};

  lines.push(`Triage answers scored ${breakdown.base_score} of ${breakdown.max_base_score} available points.`);

  const answeredNo = breakdown.questions.filter((question) => question.answer === 'No');
  if (answeredNo.length > 0) {
    lines.push(
      `Answered No, so those points are lost: ${answeredNo
        .map((question) => `${question.label} (${question.max})`)
        .join('; ')}.`
    );
  }

  const answeredUnsure = breakdown.questions.filter((question) => question.answer === 'Unsure');
  if (answeredUnsure.length > 0) {
    lines.push(
      `Marked Unsure, which scores half: ${answeredUnsure.map((question) => question.label).join('; ')}.`
    );
  }

  if (caseLaw.supports > 0) {
    lines.push(
      `${caseLaw.supports} verified supporting authorit${caseLaw.supports === 1 ? 'y' : 'ies'} added ${caseLaw.supports_points} point${caseLaw.supports_points === 1 ? '' : 's'} (3 per authority, capped at 10).`
    );
  }
  if (caseLaw.against > 0) {
    lines.push(
      `${caseLaw.against} verified authorit${caseLaw.against === 1 ? 'y' : 'ies'} against the position deducted ${Math.abs(caseLaw.against_points)} point${Math.abs(caseLaw.against_points) === 1 ? '' : 's'} (5 per authority, capped at 15).`
    );
  }
  if ((caseLaw.supports || 0) === 0 && (caseLaw.against || 0) === 0) {
    lines.push('No verified authorities are linked to this matter, so there is no case law adjustment.');
  }
  if (caseLaw.unverified > 0) {
    lines.push(
      `${caseLaw.unverified} linked authorit${caseLaw.unverified === 1 ? 'y is' : 'ies are'} not verified and did not affect the score.`
    );
  }

  lines.push(`Total ${breakdown.total} of 100, which sits in the ${breakdown.band} band.`);
  return lines;
}