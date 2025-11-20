import React, { ReactNode } from 'react';
import { motion, useMotionValue, PanInfo, animate } from 'framer-motion';
import { PencilIcon } from '../icons/PencilIcon';
import { Trash2Icon } from '../icons/Trash2Icon';

const ACTIONS_WIDTH = 128; // 2 buttons * 64px width
const SWIPE_THRESHOLD = ACTIONS_WIDTH / 2;

type SwipeableListItemProps = {
  // FIX: Made children optional to fix TypeScript error where it was not being inferred correctly from JSX.
  children?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  disableSwipe?: boolean;
};

export const SwipeableListItem = ({ children, onEdit, onDelete, disableSwipe = false }: SwipeableListItemProps) => {
  const x = useMotionValue(0);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disableSwipe) return;
    const { offset, velocity } = info;

    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -400) {
      animate(x, -ACTIONS_WIDTH, { type: 'spring', bounce: 0.1, duration: 0.4 });
    } else {
      animate(x, 0, { type: 'spring', bounce: 0.1, duration: 0.4 });
    }
  };

  const handleActionClick = (action?: () => void) => {
    if (action) {
      animate(x, 0, { type: 'spring', bounce: 0.1, duration: 0.4 }).then(action);
    }
  };

  if (disableSwipe) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: ACTIONS_WIDTH }}>
        <button
          onClick={() => handleActionClick(onEdit)}
          className="w-1/2 h-full flex items-center justify-center bg-sky-600 text-white transition-colors hover:bg-sky-700 focus:outline-none"
          aria-label="Modifier"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleActionClick(onDelete)}
          className="w-1/2 h-full flex items-center justify-center bg-red-600 text-white transition-colors hover:bg-red-700 focus:outline-none"
          aria-label="Supprimer"
        >
          <Trash2Icon className="w-5 h-5" />
        </button>
      </div>

      <motion.div
        className="relative w-full"
        drag="x"
        dragConstraints={{ left: -ACTIONS_WIDTH, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.8 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  );
};
