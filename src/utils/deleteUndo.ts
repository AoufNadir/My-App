// V19 (owner, 2026-11-19): after a delete, « Annuler » for a few seconds writes back every line that was removed, with
// the same ids and fields, so every figure is as it was. Nothing is offered when a line could not be kept.
import { saveErrorAlert } from './stockLock';

export const DELETE_DONE_MESSAGE = '✅ Transaction supprimée.';
export const DELETE_UNDONE_MESSAGE = '✅ Suppression annulée.';
export const DELETE_UNDO_ERROR = '❌ Impossible d’annuler la suppression.';

export function announceDelete(
    result: { undo?: () => Promise<void> },
    setAlert: (message: string) => void,
    notifyUndo?: (message: string, run: () => void) => void,
): void {
    const undo = result.undo;
    if (!undo || !notifyUndo) {
        setAlert(DELETE_DONE_MESSAGE);
        return;
    }
    notifyUndo(DELETE_DONE_MESSAGE, () => {
        undo().then(() => setAlert(DELETE_UNDONE_MESSAGE), (error) => {
            console.error('Undo delete failed:', error);
            setAlert(saveErrorAlert(error, DELETE_UNDO_ERROR));
        });
    });
}
