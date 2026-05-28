export const now = () => {
    const d = new Date();
    return {
        date: d.toLocaleDateString('fr-FR'),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: d.getTime()
    };
};
export const parseAndEvaluate = (expr: string): number => {
    if (!expr)
        return 0;
    const evaluateExpression = (expr: string): {
        success: boolean;
        value?: number;
        error?: string;
    } => {
        if (!expr)
            return { success: true, value: 0 };
        try {
            const sanitizedExpr = expr.replace(/,/g, '.').replace(/\s+/g, '');
            if (!sanitizedExpr)
                return { success: true, value: 0 };
            if (/[^0-9.+\-*/().]/.test(sanitizedExpr))
                return { success: false, error: "Invalid characters" };
            const result = new Function(`return ${sanitizedExpr}`)();
            if (typeof result !== 'number' || !isFinite(result))
                return { success: false, error: "Invalid expression" };
            return { success: true, value: result };
        }
        catch (e) {
            return { success: false, error: "Invalid syntax" };
        }
    };
    const result = evaluateExpression(expr);
    return result.success && result.value !== undefined ? result.value : NaN;
};
export const getRelativeDateLabel = (dateString: string, todayLabel: string, yesterdayLabel: string) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const parts = dateString.split('/');
    const txDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (txDate.toDateString() === today.toDateString())
        return `${todayLabel} (${dateString})`;
    if (txDate.toDateString() === yesterday.toDateString())
        return `${yesterdayLabel} (${dateString})`;
    return dateString;
};
