import React from 'react';
import { Badge } from './Badge';
import type { BadgeVariant, BadgeSize } from './Badge';
export type TransactionStatus = 'completed' | 'pending' | 'cancelled' | 'debt' | 'paid' | 'partial';
type StatusConfig = {
    variant: BadgeVariant;
    ar: string;
    fr: string;
};
const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
    completed: { variant: 'success', ar: 'مكتمل', fr: 'Complété' },
    pending: { variant: 'warning', ar: 'معلق', fr: 'En attente' },
    cancelled: { variant: 'neutral', ar: 'ملغي', fr: 'Annulé' },
    debt: { variant: 'debt', ar: 'دين', fr: 'Impayé' },
    paid: { variant: 'primary', ar: 'مدفوع', fr: 'Payé' },
    partial: { variant: 'secondary', ar: 'جزئي', fr: 'Partiel' },
};
export type StatusBadgeProps = {
    status: TransactionStatus;
    lang?: 'ar' | 'fr';
    /** Override the built-in label */
    label?: string;
    size?: BadgeSize;
    className?: string;
};
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, lang = 'ar', label, size = 'md', className, }) => {
    const config = STATUS_CONFIG[status];
    const displayLabel = label ?? config[lang];
    return (<Badge variant={config.variant} size={size} className={className}>
      {displayLabel}
    </Badge>);
};
StatusBadge.displayName = 'StatusBadge';
export { StatusBadge };
