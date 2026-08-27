import React from 'react';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { Button } from './Button';
type RiskAlertCardProps = {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    tone?: 'warning' | 'danger' | 'info';
};
const toneClass = {
    warning: 'border-warning/30 bg-warning-bg text-warning',
    danger: 'border-danger/30 bg-danger-bg text-danger',
    info: 'border-info/30 bg-info-bg text-info'
};
export function RiskAlertCard({ title, description, actionLabel, onAction, tone = 'warning' }: RiskAlertCardProps) {
    return (<div className={`rounded-xl border p-4 ${toneClass[tone]}`}>
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0"/>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-neutral-600">{description}</p>
        </div>
        {actionLabel && onAction && (<Button onClick={onAction} variant="outline" size="sm" className="shrink-0 text-xs font-bold">
            {actionLabel}
          </Button>)}
      </div>
    </div>);
}
