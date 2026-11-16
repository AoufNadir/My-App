// V15-3 (owner): the first-run setup is shown once, to a new account only: the server has answered, the account
// has no operation, client, treasury movement or investor, and the setup was never finished. The owner's account
// (which has data) never sees it.
export type OnboardingInput = {
    setupDone: boolean | undefined; // undefined: the server has not answered yet
    isDataLoaded: boolean;
    counts: number[];
};

export function shouldShowOnboarding({ setupDone, isDataLoaded, counts }: OnboardingInput): boolean {
    if (setupDone !== false || !isDataLoaded) return false;
    return counts.every((count) => count === 0);
}
