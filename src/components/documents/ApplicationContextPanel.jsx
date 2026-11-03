import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Scale, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const SIDES = ['Claimant', 'Defendant', 'Appellant', 'Respondent', 'Applicant'];

export default function ApplicationContextPanel({
  details = {},
  orderId = '',
  onOrderChange,
  application = '',
  onApplicationChange,
  ourSide = '',
  court = '',
  onSideChange,
  onCourtChange,
  orderFound = false,
}) {
  const order = (details.choices || []).find((choice) => choice.id === orderId) || details.order || null;
  const suggested = order ? null : details.suggested || null;

  return (
    <Card className="shadow-md border-l-4 border-l-blue-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-blue-700" />
          What is this document for?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-[11px]">The application</Label>
          <Textarea
            value={application}
            onChange={(event) => onApplicationChange(event.target.value)}
            rows={2}
            className="text-xs"
            placeholder="e.g. CPR 3.1(7) to vary or revoke the order of Mrs Justice Eady dated 25 March 2025"
          />
          {details.named && (
            <p className="mt-1 text-[11px] text-slate-500">
              Read from the application notice: “{details.named}”.
            </p>
          )}
          {details.notice?.name && (
            <p className="text-[11px] text-slate-500">
              {details.notice.name}
              {details.notice.date ? `, dated ${details.notice.date}` : ', date not confirmed'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px]">The order challenged</Label>
            <Select value={orderId} onValueChange={onOrderChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose the order challenged / Upload it" />
              </SelectTrigger>
              <SelectContent>
                {(details.choices || []).map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.name}
                    {choice.date_text ? ` - ${choice.date_text}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Date of that order</Label>
            <Input value={order?.date_text || 'Date not confirmed'} readOnly className="h-8 text-xs bg-slate-50" />
          </div>
          <div>
            <Label className="text-[11px]">Our side</Label>
            <Select value={ourSide} onValueChange={onSideChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Our side" />
              </SelectTrigger>
              <SelectContent>
                {SIDES.map((side) => (
                  <SelectItem key={side} value={side}>
                    {side}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Court</Label>
            <Input value={court} onChange={(event) => onCourtChange(event.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {!order ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 space-y-1">
            <p className="flex items-center gap-1 text-xs font-semibold text-amber-900">
              <Upload className="h-3.5 w-3.5" />
              Choose the order challenged / Upload it
            </p>
            <p className="text-[11px] text-amber-900">
              {details.named
                ? `No order in the case file matches “${details.named}”.`
                : 'No order is chosen yet.'}{' '}
              Nothing is labelled THE ORDER CHALLENGED and quotes from it are blocked until you choose it or
              upload it.
            </p>
            <Link to="/CaseFileLibrary" className="inline-block text-[11px] font-medium text-blue-700 underline">
              Open the Case File Library
            </Link>
          </div>
        ) : (
          !orderFound && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2">
              <p className="flex items-center gap-1 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                The order challenged is not ticked for this draft
              </p>
              <p className="mt-1 text-[11px] text-amber-900">
                Quotes from it are blocked until it is ticked in Source material below.
              </p>
            </div>
          )
        )}

        {suggested && (
          <div className="rounded border border-blue-300 bg-blue-50 p-2">
            <p className="text-xs font-semibold text-blue-900">
              {suggested.name}
              {suggested.date_text ? ` - ${suggested.date_text}` : ''}
            </p>
            <p className="text-[11px] text-blue-900">{suggested.note}</p>
            <div className="mt-1 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => onOrderChange(suggested.id)}
              >
                Use this judgment
              </Button>
              <Link to="/CaseFileLibrary" className="text-[11px] font-medium text-blue-700 underline">
                Upload the order
              </Link>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Only {order?.name ? `“${order.name}”` : 'the order you choose'} is labelled as the order challenged. Every
          other order and judgment is labelled an earlier decision, background, with its date.
        </p>
      </CardContent>
    </Card>
  );
}