// Numbers a rendered screen shows, as its reader sees them: amounts with their separators and
// sign, counts, dates and times. Redesign tests record them before a change and check that the
// new screen shows exactly the same ones, written the same way.

const NUMBER_TOKEN = /[+\-−]?\d(?:[\d.,:/   ]*\d)?/g;

/** Visible text of server-rendered HTML, one `|` between elements so that numbers never merge. */
export function screenText(html: string): string {
    return html
        .replace(/<!-- -->/g, '')
        .replace(/<[^>]+>/g, '|')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
}

/** Every number token of the screen, in reading order. */
export function screenNumbers(html: string): string[] {
    return screenText(html).match(NUMBER_TOKEN) ?? [];
}

/** The distinct number tokens, sorted, to compare two versions of a screen. */
export function distinctScreenNumbers(html: string): string[] {
    return [...new Set(screenNumbers(html))].sort();
}

/** Shows special spaces so that a failing comparison says which separator changed. */
export function showSpaces(tokens: readonly string[]): string[] {
    return tokens.map((token) => token.replace(/ /g, '⍽').replace(/ /g, '·'));
}
