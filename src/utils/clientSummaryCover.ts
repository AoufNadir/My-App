// V26-1 (owner): the short message that opens with the client's WhatsApp chat; the summary picture is pasted under it.
const amount = (cents: number) => `⁦${(Math.abs(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ')} DZD⁩`;
const bold = (text: string) => `*${text}*`;

export function clientSummaryCover(input: { lang: 'fr' | 'ar'; name: string; balanceCents: number; operationCount: number; date: string }): string {
    const { lang, name, balanceCents, operationCount, date } = input;
    const owes = balanceCents < -0.5, credit = balanceCents > 0.5;
    if (lang === 'ar') {
        const state = owes ? `🔸 ${bold(`الباقي عليكم: ${amount(balanceCents)}`)}` : credit ? `🔹 ${bold(`رصيدكم لدينا: ${amount(balanceCents)}`)}` : `✅ ${bold('حسابكم مسوّى')}`;
        return [`السلام عليكم ورحمة الله،`, `السيد ${bold(name)}`, '', `📋 ${bold('كشف حسابكم')} بتاريخ ${date}`, `▫️ العمليات المسجّلة: ${operationCount}`, state, '',
            'تجدون التفاصيل في الصورة المرفقة. لأي استفسار نحن في الخدمة.', '', `مع خالص التحية،`, bold('ProDigital')].join('\n');
    }
    const state = owes ? `🔸 ${bold(`Reste à régler : ${amount(balanceCents)}`)}` : credit ? `🔹 ${bold(`Votre solde chez nous : ${amount(balanceCents)}`)}` : `✅ ${bold('Votre compte est soldé')}`;
    return [`Bonjour M. ${bold(name)},`, '', `📋 ${bold('Votre relevé de compte')} au ${date}`, `▫️ Opérations enregistrées : ${operationCount}`, state, '',
        'Vous trouverez le détail dans l’image jointe. Nous restons à votre disposition.', '', 'Cordialement,', bold('ProDigital')].join('\n');
}
