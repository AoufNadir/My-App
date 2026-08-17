export const now = () => {
    const d = new Date();
    return {
        date: d.toLocaleDateString('fr-FR'),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: d.getTime()
    };
};
export type NumericExpressionResult = {
    success: boolean;
    value?: number;
    error?: 'common.invalidChars' | 'common.invalidExpression' | 'common.invalidSyntax';
};

export const evaluateNumericExpression = (expr: string): NumericExpressionResult => {
    const sanitizedExpr = expr.replace(/,/g, '.').replace(/\s+/g, '');
    if (!sanitizedExpr) {
        return { success: true, value: 0 };
    }
    if (/[^0-9.+\-*/().]/.test(sanitizedExpr)) {
        return { success: false, error: 'common.invalidChars' };
    }

    let index = 0;

    const parseExpression = (): number | null => {
        let value = parseTerm();
        if (value === null) return null;

        while (sanitizedExpr[index] === '+' || sanitizedExpr[index] === '-') {
            const operator = sanitizedExpr[index++];
            const right = parseTerm();
            if (right === null) return null;
            value = operator === '+' ? value + right : value - right;
        }

        return value;
    };

    const parseTerm = (): number | null => {
        let value = parseFactor();
        if (value === null) return null;

        while (sanitizedExpr[index] === '*' || sanitizedExpr[index] === '/') {
            const operator = sanitizedExpr[index++];
            const right = parseFactor();
            if (right === null) return null;
            value = operator === '*' ? value * right : value / right;
        }

        return value;
    };

    const parseFactor = (): number | null => {
        const token = sanitizedExpr[index];
        if (token === '+' || token === '-') {
            index++;
            const value = parseFactor();
            if (value === null) return null;
            return token === '-' ? -value : value;
        }

        if (token === '(') {
            index++;
            const value = parseExpression();
            if (value === null || sanitizedExpr[index] !== ')') return null;
            index++;
            return value;
        }

        return parseNumber();
    };

    const parseNumber = (): number | null => {
        const start = index;
        let dotCount = 0;

        while (index < sanitizedExpr.length) {
            const char = sanitizedExpr[index];
            if (char === '.') {
                dotCount++;
                if (dotCount > 1) return null;
                index++;
                continue;
            }
            if (char < '0' || char > '9') break;
            index++;
        }

        const rawNumber = sanitizedExpr.slice(start, index);
        if (!rawNumber || rawNumber === '.') return null;
        const value = Number(rawNumber);
        return Number.isFinite(value) ? value : null;
    };

    const value = parseExpression();
    if (value === null || index !== sanitizedExpr.length) {
        return { success: false, error: 'common.invalidSyntax' };
    }
    if (!Number.isFinite(value)) {
        return { success: false, error: 'common.invalidExpression' };
    }

    return { success: true, value };
};

export const parseAndEvaluate = (expr: string): number => {
    const result = evaluateNumericExpression(expr);
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
