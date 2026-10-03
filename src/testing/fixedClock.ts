// Screens with a countdown, "today" or the last 7 days read the clock. Import this module first
// in such a test: the clock then stays at FIXED_NOW, in Algeria's time zone (UTC+1).
process.env.TZ = 'Africa/Algiers';

/** Wednesday 30/09/2026, 15:00 in Algeria. */
export const FIXED_NOW = new Date(2026, 8, 30, 15, 0, 0).getTime();

const RealDate = Date;
globalThis.Date = new Proxy(RealDate, {
    // `new Date()` without arguments reads the fixed clock; any other call is untouched.
    construct(target, args, newTarget) {
        return Reflect.construct(target, args.length === 0 ? [FIXED_NOW] : args, newTarget);
    },
    get(target, key, receiver) {
        if (key === 'now')
            return () => FIXED_NOW;
        return Reflect.get(target, key, receiver);
    },
});
