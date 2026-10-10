import assert from 'node:assert/strict';

import { monthPeriod, monthWeeks, parseDayKey, rangePeriod, yearPeriod } from '../../utils/clientActivityReport';
import { PDF_PAGE_HEIGHT_PX, PDF_PAGE_MARGIN_PX, pageRowWindow, planPdfPages } from '../reports/reportPdf';
import { reportFileName } from './clientActivityReportPdf';

// The PDF is the report cut into A4 pages: at the top of a block or of a table row, never
// through a line of text, every part of the report on exactly one page.

const firstCapacity = PDF_PAGE_HEIGHT_PX - PDF_PAGE_MARGIN_PX;
const nextCapacity = PDF_PAGE_HEIGHT_PX - 2 * PDF_PAGE_MARGIN_PX;

const check = (height: number, breaks: number[]) => {
    const slices = planPdfPages(height, breaks);
    assert.equal(slices[0].top, 0, 'The first page starts at the top');
    assert.equal(slices[slices.length - 1].bottom, height, 'The last page ends at the bottom');
    slices.forEach((slice, index) => {
        assert.ok(slice.bottom > slice.top, 'No empty page');
        assert.ok(slice.bottom - slice.top <= (index === 0 ? firstCapacity : nextCapacity) + 1e-9, `Page ${index + 1} fits on A4 with its margins`);
        if (index > 0)
            assert.equal(slice.top, slices[index - 1].bottom, 'Pages follow each other: nothing lost, nothing twice');
    });
    return slices;
};

assert.equal(check(900, [100, 400]).length, 1, 'A short report is one page');
assert.equal(check(firstCapacity, [500]).length, 1, 'Exactly one page high: one page');

// Cut at the last break that fits.
const twoPages = check(1800, [200, 600, 1000, 1080, 1300, 1700]);
assert.deepEqual(twoPages.map((slice) => slice.bottom), [1080, 1800], 'The first page ends at the last block that fits');

// A block taller than a page is cut where the page ends.
const tall = check(3000, [50]);
assert.equal(tall[0].bottom, firstCapacity);
assert.equal(tall[1].bottom, firstCapacity + nextCapacity);

// A break too close to the top would leave a nearly empty page: the page is filled instead.
const early = check(2000, [100, firstCapacity + 10]);
assert.equal(early[0].bottom, firstCapacity, 'A break in the first quarter of the page is not used');

// A long monthly report: rows every 50px from 1100 on.
const rows = Array.from({ length: 60 }, (_, index) => 1100 + index * 50);
const long = check(4200, [120, 300, 600, 900, ...rows]);
long.slice(0, -1).forEach((slice) => assert.ok([120, 300, 600, 900, ...rows].includes(slice.bottom), 'Every cut is at a block or a row'));

// File names the client sees.
assert.equal(reportFileName(monthPeriod(2026, 8)), 'ProDigital_2026-09.pdf');
assert.equal(reportFileName(yearPeriod(2026)), 'ProDigital_2026.pdf');
assert.equal(reportFileName(rangePeriod(parseDayKey('2026-09-15', false)!, parseDayKey('2026-10-14', true)!)), 'ProDigital_2026-09-15_2026-10-14.pdf');
assert.equal(reportFileName(monthWeeks(2026, 9)[1]), 'ProDigital_2026-10-04_2026-10-10.pdf', 'A week is named by its days');

// Each page is captured without the list rows of the other pages: every row on exactly one page,
// and the first row kept takes the place of the first row left out.
const listTop = 1500;
const listRows = Array.from({ length: 300 }, (_, index) => ({ top: listTop + index * 37.5, bottom: listTop + (index + 1) * 37.5 }));
const sheetHeight = listTop + 300 * 37.5 + 80;
const pages = check(sheetHeight, [120, 400, 900, 1400, ...listRows.slice(1).map((row) => row.top), listTop + 300 * 37.5 + 20]);
assert.ok(pages.length >= 11, `a long list is many pages (${pages.length})`);
const seen = new Array(listRows.length).fill(0);
for (const page of pages) {
    const { skip, shift } = pageRowWindow(listRows, page);
    const kept = listRows.map((row, index) => index).filter((index) => !skip.has(index));
    kept.forEach((index) => {
        seen[index] += 1;
        assert.ok(listRows[index].top >= page.top - 0.5 && listRows[index].bottom <= page.bottom + 0.5, `row ${index} lies inside its page`);
    });
    if (kept.length && kept[0] > 0)
        assert.equal(listRows[kept[0]].top - shift, listRows[0].top, 'The page\'s first row moves up to where the list starts');
    if (page.top < listTop)
        assert.equal(shift, 0, 'Nothing moves on a page that starts before the list');
}
assert.ok(seen.every((count) => count === 1), 'Every row is on one page, and only one');
const afterList = pageRowWindow(listRows, { top: listTop + 300 * 37.5 + 20, bottom: sheetHeight });
assert.equal(afterList.skip.size, 300, 'A page after the list keeps none of its rows');
assert.equal(afterList.shift, 300 * 37.5, '…and everything after the list moves up by the whole list');
assert.deepEqual(pageRowWindow([], { top: 0, bottom: 1000 }), { skip: new Set(), shift: 0 }, 'A report without operations');

// V3-6: a sheet with several lists (the monthly report). Only the rows leave the layout: the titles
// and the table headers between two lists stay, so they are not counted in how far the page moves up.
{
    const first = Array.from({ length: 10 }, (_, index) => ({ top: 400 + index * 40, bottom: 440 + index * 40 }));
    const second = Array.from({ length: 10 }, (_, index) => ({ top: 1000 + index * 40, bottom: 1040 + index * 40 }));
    const both = [...first, ...second];
    // A page that starts in the second list, five rows in (the title and header of the list are 160px).
    const page = { top: 1200, bottom: 1400 };
    const { skip, shift } = pageRowWindow(both, page);
    assert.deepEqual([...skip].sort((a, b) => a - b), [...Array(15).keys()], 'The ten rows of the first list and the first five of the second leave');
    assert.equal(shift, 15 * 40, 'Fifteen rows of 40px leave the layout, not the 560px that lie between the first row and the sixth row of the second list');
    // A page inside the first list leaves the second list out and moves nothing before it.
    const inFirst = pageRowWindow(both, { top: 600, bottom: 800 });
    assert.equal(inFirst.shift, 5 * 40);
    assert.ok([...Array(10).keys()].map((index) => index + 10).every((index) => inFirst.skip.has(index)), 'The second list is left out');
}

console.log('client activity report PDF pages tests passed');
