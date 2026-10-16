const NodeCache = require("node-cache");

// Default TTL: 60 seconds (as specified in Practical 9 problem statement)
const DEFAULT_TTL = 60;
const cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: 120 });

// Custom counters for hits and misses tracking
let hitCount = 0;
let missCount = 0;
let writeCount = 0;
let invalidationCount = 0;

// Wrap methods to track metrics
const originalGet = cache.get.bind(cache);
const originalSet = cache.set.bind(cache);
const originalDel = cache.del.bind(cache);
const originalFlushAll = cache.flushAll.bind(cache);

cache.get = (key) => {
    const val = originalGet(key);
    if (val !== undefined) {
        hitCount++;
    } else {
        missCount++;
    }
    return val;
};

cache.set = (key, val, ttl) => {
    writeCount++;
    return originalSet(key, val, ttl);
};

cache.del = (keys) => {
    invalidationCount++;
    return originalDel(keys);
};

cache.flushAll = () => {
    invalidationCount++;
    return originalFlushAll();
};

cache.getCustomStats = () => {
    const totalLookups = hitCount + missCount;
    const hitRatio = totalLookups > 0 ? ((hitCount / totalLookups) * 100).toFixed(1) + "%" : "0.0%";
    return {
        hits: hitCount,
        misses: missCount,
        totalLookups,
        hitRatio,
        writes: writeCount,
        invalidations: invalidationCount,
        activeKeysCount: cache.keys().length,
        activeKeys: cache.keys(),
        stdTTL: cache.options.stdTTL || DEFAULT_TTL,
        internalStats: cache.getStats()
    };
};

cache.resetCounters = () => {
    hitCount = 0;
    missCount = 0;
    writeCount = 0;
    invalidationCount = 0;
};

cache.setTTL = (ttl) => {
    const seconds = parseInt(ttl, 10);
    if (seconds > 0) {
        cache.options.stdTTL = seconds;
    }
};

cache.getTTL = () => cache.options.stdTTL || DEFAULT_TTL;

module.exports = cache;
