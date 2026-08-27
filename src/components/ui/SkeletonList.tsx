import React from 'react';
import { Skeleton } from './Skeleton';
export interface SkeletonListProps {
    rows?: number;
    itemHeight?: number;
    className?: string;
}
export const SkeletonList: React.FC<SkeletonListProps> = ({ rows = 6, itemHeight = 64, className = '', }) => (<div className={`flex flex-col gap-2 ${className}`} aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (<Skeleton key={i} height={itemHeight} className="w-full"/>))}
  </div>);
