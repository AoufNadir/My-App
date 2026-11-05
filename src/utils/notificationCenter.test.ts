import assert from 'node:assert/strict';
import { badgeTone, isUnread, markAllRead, parseReadMap, unreadCount, type NotificationEntry } from './notificationCenter';

const debts = (count: number): NotificationEntry => ({ id: 'overdue', signature: String(count), urgent: true });
const term: NotificationEntry = { id: 'term-1', signature: 'term-1' };

assert.equal(unreadCount([debts(18), term], {}), 2, 'nothing read yet');
const read = markAllRead([debts(18), term]);
assert.equal(unreadCount([debts(18), term], read), 0, 'all read');
assert.equal(badgeTone([debts(18), term], read), 'none', 'no badge when all is read');
assert.equal(isUnread(debts(19), read), true, 'a state that changed comes back unread');
assert.equal(badgeTone([debts(19), term], read), 'urgent', 'late clients unread: red badge');
assert.equal(badgeTone([term], {}), 'info', 'an event alone: blue badge');
assert.equal(unreadCount([], {}), 0);
assert.deepEqual(markAllRead([term]), { 'term-1': 'term-1' }, 'gone items are forgotten');
assert.deepEqual(parseReadMap(null), {});
assert.deepEqual(parseReadMap('not json'), {});
assert.deepEqual(parseReadMap('[1,2]'), {});
assert.deepEqual(parseReadMap('{"a":"1","b":2}'), { a: '1' }, 'only text signatures are kept');
console.log('notificationCenter tests passed');
