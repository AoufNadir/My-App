import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { ButtonVariant } from './Button';
export type ConfirmDialogVariant = 'danger' | 'warning' | 'primary';
export type ConfirmDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmDialogVariant;
    loading?: boolean;
};
const ICON_CONFIG: Record<ConfirmDialogVariant, {
    bg: string;
    color: string;
    path: string;
}> = {
    danger: {
        bg: 'bg-danger-bg',
        color: 'text-danger',
        path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    },
    warning: {
        bg: 'bg-warning-bg',
        color: 'text-warning',
        path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    },
    primary: {
        bg: 'bg-primary/10',
        color: 'text-primary',
        path: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z',
    },
};
const CONFIRM_VARIANT_MAP: Record<ConfirmDialogVariant, ButtonVariant> = {
    danger: 'danger',
    warning: 'danger',
    primary: 'primary',
};
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onClose, onConfirm, title, description, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', variant = 'danger', loading = false, }) => {
    const icon = ICON_CONFIG[variant];
    return (<Modal isOpen={isOpen} onClose={onClose} layout="auto">
      <div className="bg-surface p-6 flex flex-col gap-4">
        {/* أيقونة + عنوان */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${icon.bg}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`h-6 w-6 ${icon.color}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon.path}/>
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          {description && (<p className="text-sm text-neutral-500 max-w-xs">{description}</p>)}
        </div>

        {/* أزرار */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" size="md" onClick={onClose} disabled={loading} className="sm:min-w-[120px]">
            {cancelLabel}
          </Button>
          <Button variant={CONFIRM_VARIANT_MAP[variant]} size="md" onClick={onConfirm} loading={loading} className="sm:min-w-[120px]">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>);
};
ConfirmDialog.displayName = 'ConfirmDialog';
export { ConfirmDialog };
