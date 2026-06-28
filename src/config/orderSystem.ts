// Pro Digital Orders — runtime configuration.
//
// The operator's Firebase Auth uid. This MUST be kept in sync with the
// operatorUid() function in firestore.rules.
//
// While left as the 'OPERATOR_UID' placeholder the order-system role gate stays
// DORMANT: the app behaves exactly as before (the signed-in user goes straight
// to the operator dashboard). Once set to the real uid, AppContent routes
// clients/agents to their own surfaces and only the operator reaches MainApp.
//
// Typed as `string` (not the literal) so the configured/placeholder comparison
// below type-checks.
export const OPERATOR_UID: string = 'OPERATOR_UID';

/** True once a real operator uid has been configured. */
export const ORDER_SYSTEM_CONFIGURED = OPERATOR_UID !== 'OPERATOR_UID';

/** Whether the given uid is the operator (admin) — only when configured. */
export function isOperatorUid(uid: string | null | undefined): boolean {
    return ORDER_SYSTEM_CONFIGURED && !!uid && uid === OPERATOR_UID;
}
