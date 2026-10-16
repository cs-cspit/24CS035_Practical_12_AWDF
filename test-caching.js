const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();

const BASE_URL = "http://localhost:5000";

async function runCachingSuite() {
    console.log("===============================================================");
    console.log("   PRACTICAL 9: IN-MEMORY CACHING & PERFORMANCE TEST SUITE   ");
    console.log("===============================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, extra = "") {
        if (condition) {
            console.log(`[PASS] ${testName} ${extra}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName} ${extra}`);
            failed++;
        }
    }

    try {
        // 1. Health & Server check
        const resHealth = await fetch(`${BASE_URL}/health`);
        assert(resHealth.status === 200, "1. Server is running (GET /health -> 200)");

        // 2. Authentication: Register/Login test account
        const testUser = {
            name: "Samarth Kalavadia",
            email: `cache_test_${Date.now()}@charusat.edu.in`,
            password: "SecureCache123!"
        };

        const resReg = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testUser)
        });
        const jsonReg = await resReg.json();
        const token = jsonReg.token;
        assert(!!token, "2. User registered & JWT acquired");

        // 3. Populate sample tasks if needed
        const sampleTasks = [
            { title: "Optimize DB Indexing", description: "Compound index on user and createdAt" },
            { title: "Configure node-cache In-Memory Layer", description: "Set stdTTL: 60s for /tasks endpoint" },
            { title: "Measure API Response Latency", description: "Record 3 sample readings cached vs uncached" },
            { title: "Implement Cache Invalidation Hook", description: "Clear key 'all_tasks' on POST, PUT, DELETE" }
        ];

        let createdTaskIds = [];
        for (const st of sampleTasks) {
            const resPost = await fetch(`${BASE_URL}/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(st)
            });
            const dataPost = await resPost.json();
            if (dataPost.task && dataPost.task._id) {
                createdTaskIds.push(dataPost.task._id);
            }
        }
        assert(createdTaskIds.length >= 4, `3. Seeded ${createdTaskIds.length} sample tasks`);

        // 4. Reset cache for clean benchmarking
        await fetch(`${BASE_URL}/cache/clear`, { method: "POST" });
        console.log("\n--- BENCHMARK: UNCACHED VS CACHED GET /tasks ---");

        // Step 6: 3 Uncached Readings (Cache bypassed)
        const uncachedReadings = [];
        for (let i = 1; i <= 3; i++) {
            const start = performance.now();
            const res = await fetch(`${BASE_URL}/tasks?nocache=true`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const duration = parseFloat((performance.now() - start).toFixed(2));
            const data = await res.json();
            const headerTime = res.headers.get("x-response-time") || `${duration}ms`;
            const cacheStatus = res.headers.get("x-cache") || "BYPASS";
            uncachedReadings.push(duration);
            console.log(`Uncached Run ${i}: Response Time = ${duration} ms (Server: ${headerTime}, Cache: ${cacheStatus}, Tasks: ${data.length})`);
        }

        // Step 3 & 5: First GET (Cache MISS -> stores in cache) followed by 3 Cached GETs (Cache HIT)
        const startMiss = performance.now();
        const resMiss = await fetch(`${BASE_URL}/tasks`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const durationMiss = parseFloat((performance.now() - startMiss).toFixed(2));
        const cacheMissHeader = resMiss.headers.get("x-cache");
        assert(cacheMissHeader === "MISS", "4. First GET /tasks resulted in Cache MISS", `(${durationMiss} ms)`);

        const cachedReadings = [];
        for (let i = 1; i <= 3; i++) {
            const start = performance.now();
            const res = await fetch(`${BASE_URL}/tasks`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const duration = parseFloat((performance.now() - start).toFixed(2));
            const data = await res.json();
            const headerTime = res.headers.get("x-response-time") || `${duration}ms`;
            const cacheStatus = res.headers.get("x-cache") || "HIT";
            cachedReadings.push(duration);
            console.log(`Cached Run ${i}:   Response Time = ${duration} ms (Server: ${headerTime}, Cache: ${cacheStatus}, Tasks: ${data.length})`);
            assert(cacheStatus === "HIT", `5.${i} Cached Run ${i} is Cache HIT`);
        }

        const avgUncached = (uncachedReadings.reduce((a, b) => a + b, 0) / uncachedReadings.length).toFixed(2);
        const avgCached = (cachedReadings.reduce((a, b) => a + b, 0) / cachedReadings.length).toFixed(2);
        const speedup = (((avgUncached - avgCached) / avgUncached) * 100).toFixed(1);

        console.log("\n=======================================================");
        console.log(`Summary: Uncached Avg = ${avgUncached} ms | Cached Avg = ${avgCached} ms | Speedup = ${speedup}%`);
        console.log("=======================================================\n");

        // 5. Test Supplementary Problem 1: Single Task Caching (GET /tasks/:id)
        console.log("--- TESTING SINGLE TASK CACHING (GET /tasks/:id) ---");
        const sampleId = createdTaskIds[0];

        // 1st fetch -> Cache MISS
        const resSingle1 = await fetch(`${BASE_URL}/tasks/${sampleId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resSingle1.headers.get("x-cache") === "MISS", "6. Single task initial fetch is Cache MISS");

        // 2nd fetch -> Cache HIT
        const resSingle2 = await fetch(`${BASE_URL}/tasks/${sampleId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resSingle2.headers.get("x-cache") === "HIT", "7. Single task subsequent fetch is Cache HIT");

        // 6. Test Step 4: Cache Invalidation on Writes (POST, PUT, DELETE)
        console.log("\n--- TESTING CACHE INVALIDATION ON WRITE OPERATIONS ---");

        // Invalidation on POST:
        await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ title: "Write Invalidation Test", description: "Testing cache invalidation" })
        });
        const resAfterPost = await fetch(`${BASE_URL}/tasks`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resAfterPost.headers.get("x-cache") === "MISS", "8. POST invalidated 'all_tasks' cache (subsequent GET is MISS)");

        // Prime single task cache then test Invalidation on PUT:
        await fetch(`${BASE_URL}/tasks/${sampleId}`, { headers: { "Authorization": `Bearer ${token}` } });
        await fetch(`${BASE_URL}/tasks/${sampleId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ completed: true })
        });
        const resAfterPutSingle = await fetch(`${BASE_URL}/tasks/${sampleId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resAfterPutSingle.headers.get("x-cache") === "MISS", "9. PUT invalidated single task cache 'task_:id'");

        const resAfterPutAll = await fetch(`${BASE_URL}/tasks`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resAfterPutAll.headers.get("x-cache") === "MISS", "10. PUT invalidated 'all_tasks' cache");

        // Invalidation on DELETE:
        await fetch(`${BASE_URL}/tasks/${sampleId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const resAfterDelete = await fetch(`${BASE_URL}/tasks`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        assert(resAfterDelete.headers.get("x-cache") === "MISS", "11. DELETE invalidated 'all_tasks' cache");

        // 7. Test Supplementary Problem 2: Debug Cache Stats Endpoint
        console.log("\n--- TESTING CACHE STATS DEBUG ENDPOINT ---");
        const resStats = await fetch(`${BASE_URL}/cache/stats`);
        const jsonStats = await resStats.json();
        assert(resStats.status === 200 && jsonStats.data.hits > 0, "12. Debug stats endpoint exposed with hit/miss counters", `(Hits: ${jsonStats.data.hits}, Misses: ${jsonStats.data.misses}, Ratio: ${jsonStats.data.hitRatio})`);

        // 8. Test Supplementary Problem 3: TTL Modification
        console.log("\n--- TESTING TTL CONFIGURATION ENDPOINT ---");
        const resTTL = await fetch(`${BASE_URL}/tasks/cache/ttl`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ttl: 30 })
        });
        const jsonTTL = await resTTL.json();
        assert(resTTL.status === 200 && jsonTTL.stdTTL === 30, "13. TTL configurable via debug endpoint (set to 30s)");

        console.log(`\n=======================================================`);
        console.log(`TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
        console.log(`=======================================================`);

        // Return readings for documentation
        return {
            uncachedReadings,
            cachedReadings,
            avgUncached,
            avgCached,
            speedup,
            stats: jsonStats.data
        };
    } catch (err) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

if (require.main === module) {
    runCachingSuite();
}

module.exports = runCachingSuite;
