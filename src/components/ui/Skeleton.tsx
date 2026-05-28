import React from 'react';
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: number | string;
    height?: number | string;
    circle?: boolean;
}
export const Skeleton: React.FC<SkeletonProps> = ({ width, height, circle = false, className = '', style, ...rest }) => {
    const radius = circle ? '9999px' : undefined;
    // Technical exception: skeleton dimensions are data-driven placeholders.
    const skeletonStyle = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
        ...style,
    };
    return (<div aria-hidden="true" className={`animate-pulse bg-neutral-200 ${circle ? '' : 'rounded-xl'} ${className}`} style={skeletonStyle} {...rest}/>);
};
