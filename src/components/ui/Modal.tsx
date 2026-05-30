import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog';
import type { DialogLayout } from './Dialog';

export type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    layout?: DialogLayout;
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, className, layout = 'auto' as DialogLayout }) => (<Dialog isOpen={isOpen} onClose={onClose} className={className} layout={layout}>
    {children}
  </Dialog>);

Modal.displayName = 'Modal';

export { Modal, DialogContent as ModalContent, DialogDescription as ModalDescription, DialogFooter as ModalFooter, DialogHeader as ModalHeader, DialogTitle as ModalTitle };
