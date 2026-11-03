import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Database, Loader2, Play, Trash2, XCircle } from 'lucide-react';
import { ALL_TESTS, FUNCTION_COUNT, MODULE_TESTS, FUNCTION_TESTS } from '@/lib/selfTests';
import { createTestData, deleteTestData, findTestMatter } from '@/lib/testMatter';
import { TEST_MATTER_NAME } from '@/lib/testFixtures';
import { SAFETY_FOOTER } from '@/lib/safety';

function ResultRow({ result }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
      {result.pass ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{result.label}</span>
          <Badge variant="outline" className="border-slate-200 text-xs text-slate-600">
            {result.module}
          </Badge>
          <span className="text-xs text-slate-400">{result.ms} ms</span>
        </div>
        <p className={`mt-0.5 text-xs ${result.pass ? 'text-slate-600' : 'text-red-700'}`}>{result.reason}</p>
      </div>
      <Badge
        variant="outline"
        className={
          result.pass
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }
      >
        {result.pass ? 'Pass' : 'Fail'}
      </Badge>
    </div>
  );
}

export default function SelfTest() {
  const [matter, setMatter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [current, setCurrent] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const refresh = async () => {
    const found = await findTestMatter();
    setMatter(found);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch((err) => {
      setError(err.message || 'The test matter could not be checked.');
      setLoading(false);
    });
  }, []);

  const create = async () => {
    setBusy('create');
    setError('');
    try {
      const created = await createTestData();
      setMatter(created);
    } catch (err) {
      setError(err.message || 'The test data could not be created.');
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError('');
    try {
      await deleteTestData();
      setMatter(null);
      setResults([]);
    } catch (err) {
      setError(err.message || 'The test data could not be deleted.');
    } finally {
      setBusy('');
    }
  };

  const runAll = async () => {
    setBusy('run');
    setError('');
    setResults([]);
    const collected = [];
    for (const test of ALL_TESTS) {
      setCurrent(test.label);
      const started = performance.now();
      let outcome;
      try {
        outcome = await test.run();
      } catch (err) {
        outcome = { pass: false, reason: err?.message || 'Threw an error.' };
      }
      collected.push({
        ...test,
        pass: Boolean(outcome?.pass),
        reason: outcome?.reason || '',
        ms: Math.round(performance.now() - started)
      });
      setResults([...collected]);
    }
    setCurrent('');
    setBusy('');
  };

  const moduleResults = results.filter((result) => result.module !== 'function');
  const functionResults = results.filter((result) => result.module === 'function');
  const modulePassed = moduleResults.filter((result) => result.pass).length;
  const functionPassed = functionResults.filter((result) => result.pass).length;
  const failures = results.filter((result) => !result.pass);
  const finished = results.length === ALL_TESTS.length && !busy;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Self-test</h1>
        <p className="mt-1 text-sm text-slate-600">
          Runs every module in <span className="font-medium">src/lib</span> and every backend function against a
          synthetic test matter. Nothing here is a live matter, and no live record is read or changed.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-slate-500" /> Test data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            {loading
              ? 'Checking for the test matter...'
              : matter
                ? `“${TEST_MATTER_NAME}” exists with its eight synthetic documents, a stored authority and two judgments.`
                : 'No test matter yet. Create it to give the tests labelled documents to work on.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={create} disabled={Boolean(busy) || Boolean(matter)}>
              {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Create test data
            </Button>
            <Button variant="outline" onClick={remove} disabled={Boolean(busy) || !matter}>
              {busy === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete test data
            </Button>
            <Button onClick={runAll} disabled={Boolean(busy) || !matter}>
              {busy === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run all tests
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Running the tests makes one short call to each of the {FUNCTION_COUNT} backend functions, which uses
            integration credits. The module tests use no credits.
          </p>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </CardContent>
      </Card>

      {(results.length > 0 || busy === 'run') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {busy === 'run' && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Running: {current}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Functions</p>
                <p className="text-lg font-semibold text-slate-900">
                  {functionPassed} of {FUNCTION_COUNT} functions passed
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Modules</p>
                <p className="text-lg font-semibold text-slate-900">
                  {modulePassed} of {MODULE_TESTS.length} module checks passed
                </p>
              </div>
            </div>

            {finished && failures.length === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Every check passed, including promptness of 512 days, the defendant statement as Other side, the
                transcript lines by printed number, paragraph 46 beyond character 5,000, and an empty triage of 0.
              </div>
            )}

            {failures.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800">
                  {failures.length} failure{failures.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 space-y-1">
                  {failures.map((failure) => (
                    <li key={failure.id} className="text-xs text-red-700">
                      {failure.label} — {failure.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Modules</p>
              {moduleResults.length === 0 ? (
                <p className="text-sm text-slate-500">Not run yet.</p>
              ) : (
                moduleResults.map((result) => <ResultRow key={result.id} result={result} />)
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Backend functions</p>
              {functionResults.length === 0 ? (
                <p className="text-sm text-slate-500">Not run yet.</p>
              ) : (
                functionResults.map((result) => <ResultRow key={result.id} result={result} />)
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        {SAFETY_FOOTER}
      </div>
    </div>
  );
}