export const getRallyTimes = (stats, extraEndBuffer = 1) => {
  if (!stats || stats.length === 0) return [];

  const rallyMap = new Map();

  for (const stat of stats) {
    const { set, rally_id, timestamp } = stat;
    if (set == null || rally_id == null || timestamp == null) continue;

    const key = `${set}-${rally_id}`;
    const existing = rallyMap.get(key);

    if (!existing) {
      rallyMap.set(key, {
        rally_id,
        set,
        earliest: timestamp,
        lastTouch: stat,
        firstActionType: stat.action_type,
        count: 1,
      });
    } else {
      rallyMap.set(key, {
        ...existing,
        earliest: Math.min(existing.earliest, timestamp),
        lastTouch: stat.timestamp > existing.lastTouch.timestamp ? stat : existing.lastTouch,
        count: existing.count + 1,
      });
    }
  }

  const rallies = [];

  for (const { earliest, lastTouch, firstActionType, count } of rallyMap.values()) {
    let start = earliest - 1;
    if (
      (count === 1 && !lastTouch.player) ||
      (firstActionType && firstActionType.toLowerCase() !== "serve" && lastTouch.player)
    ) {
      start -= 2;
    }
    start = Math.max(0, start);
    
    let end = lastTouch.timestamp + extraEndBuffer;
    if (count === 1 && lastTouch.action_type === "Serve") {
      end += 1;
    }

    rallies.push({ start, end, set: lastTouch.set, rally_id: lastTouch.rally_id });
  }
  return rallies.sort((a, b) => a.start - b.start);

};
