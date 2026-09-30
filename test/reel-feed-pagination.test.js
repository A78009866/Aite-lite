'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { paginateReelRows, timestampFromPushKey } = require('../lib/reel-feed-pagination');

function snapshotForPage(allRows, cursor, pageSize) {
  const eligible = cursor ? allRows.filter(row => row.key <= cursor) : allRows;
  const queryLimit = pageSize + (cursor ? 2 : 1);
  return eligible.slice(-queryLimit);
}

test('cursor pages cover every reel once without gaps', () => {
  const allRows = Array.from({ length: 55 }, (_, index) => ({
    key: `push-${String(index).padStart(3, '0')}`,
    value: { reelId: `reel-${index}` }
  }));
  const collected = [];
  let cursor = null;
  let hasMore = true;
  while (hasMore) {
    const snapshotRows = snapshotForPage(allRows, cursor, 20);
    const page = paginateReelRows(snapshotRows, cursor, 20);
    collected.push(...page.selectedRows.map(row => row.value.reelId));
    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }

  assert.equal(collected.length, 55);
  assert.equal(new Set(collected).size, 55);
  assert.deepEqual(collected.slice(0, 3), ['reel-35', 'reel-36', 'reel-37']);
  assert.deepEqual(collected.slice(-3), ['reel-12', 'reel-13', 'reel-14']);
});

test('push-key timestamp fallback handles malformed IDs safely', () => {
  assert.equal(timestampFromPushKey('--------abcdefghijkl'), 0);
  assert.equal(timestampFromPushKey('########rest'), 0);
  assert.equal(timestampFromPushKey(''), 0);
});
