'use strict';

/**
 * Select one page from Firebase's ascending `orderByKey()` snapshot rows.
 * `endAt(beforeKey)` is inclusive, so the cursor row is discarded before the
 * page is selected. One extra row tells the client whether another page exists.
 */
function paginateReelRows(rows, beforeKey, pageSize) {
  const eligible = rows.filter(row => row && row.key && (!beforeKey || row.key !== beforeKey));
  const hasMore = eligible.length > pageSize;
  const selectedRows = eligible.slice(-pageSize);
  const nextCursor = hasMore && selectedRows.length ? selectedRows[0].key : null;
  return { selectedRows, hasMore, nextCursor };
}

/** Recover the creation time encoded in the first 8 chars of a Firebase push key. */
function timestampFromPushKey(key) {
  const chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  if (!key || key.length < 8) return 0;
  let timestamp = 0;
  for (let i = 0; i < 8; i++) {
    const digit = chars.indexOf(key.charAt(i));
    if (digit < 0) return 0;
    timestamp = timestamp * 64 + digit;
  }
  return timestamp;
}

module.exports = { paginateReelRows, timestampFromPushKey };
