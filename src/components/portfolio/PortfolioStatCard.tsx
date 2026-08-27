import React from 'react';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/IconButton';
import { PencilIcon } from '../icons/PencilIcon';

type PortfolioStatCardProps = {
    title: string;
    value: string;
    currency?: string;
    colorClass: string;

    onEdit?: () => void;
    children?: React.ReactNode;
    className?: string;
};

export function PortfolioStatCard({
    title,
    value,
    currency,
    colorClass,
    onEdit,
    children,
    className,
}: PortfolioStatCardProps) {
    return (
        <Card className={`group relative p-5 ${onEdit ? 'cursor-pointer' : ''} ${className || ''}`} onClick={onEdit}>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-neutral-500">
                <span>{title}</span>
                {onEdit && (
                    <IconButton
                        label={`Modifier ${title}`}
                        variant="edit"
                        size="sm"
                        className="absolute end-3 top-3 opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit();
                        }}
                    >
                        <PencilIcon />
                    </IconButton>
                )}
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums" dir="ltr">
                <span className={colorClass}>{value}</span>
                {currency && <span className="ms-2 text-lg font-normal text-neutral-500">{currency}</span>}
            </div>
            {children}
        </Card>
    );
}
