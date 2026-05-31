import { useState } from 'react';
import { Button } from './Button';

type Props = {
    onRequest: () => Promise<'default' | 'granted' | 'denied' | 'unsupported'>;
    onDismiss: () => void;
};

export function NotificationPermissionBanner({ onRequest, onDismiss }: Props) {
    const [isLoading, setIsLoading] = useState(false);

    const handleEnable = async () => {
        setIsLoading(true);
        await onRequest();
        setIsLoading(false);
    };

    return (
        <div className="anim-fade-slide-down mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="text-xl shrink-0 mt-0.5">🔔</span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-800">Activer les notifications</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                    Recevez des alertes pour les dettes en retard et les profits à distribuer.
                </p>
                <div className="flex items-center gap-2 mt-2">
                    <Button type="button" size="sm" onClick={handleEnable} disabled={isLoading} className="font-bold">
                        {isLoading ? 'En cours…' : 'Activer'}
                    </Button>
                    <button type="button" onClick={onDismiss} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    );
}
