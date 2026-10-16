const puppeteer = require("puppeteer-core");
const path = require("path");

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = "http://localhost:5173";
const API_BASE = "http://localhost:5000";
const OUTPUT_DIR = "c:\\Documents\\COLLEGE DOCUMENTS\\Semester 5\\AWDF\\Practical 9";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
    console.log("Launching Microsoft Edge via puppeteer-core...");
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1366,860"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 860, deviceScaleFactor: 1.5 });

    // Step 1: Open login view and register fresh user account
    console.log("1. Setting up fresh user account...");
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle0" });
    await sleep(600);

    // Switch to Register tab
    await page.click(".auth-tabs .auth-tab:last-child");
    await sleep(400);

    const testEmail = `samarth_p9_${Date.now()}@charusat.edu.in`;
    await page.type("#reg-name", "Samarth Kalavadia");
    await page.type("#auth-email", testEmail);
    await page.type("#auth-password", "Practical9CachePass!");
    await page.click(".auth-submit-btn");
    await sleep(1500);

    // Step 2: Seed tasks to establish realistic task database
    console.log("2. Adding realistic tasks for Practical 9...");
    const tasksToAdd = [
        {
            title: "Configure node-cache In-Memory Cache (stdTTL: 60s)",
            desc: "Instantiate shared node-cache singleton module to store GET /tasks results."
        },
        {
            title: "Implement Cache Invalidation on Writes (POST, PUT, DELETE)",
            desc: "Evict all_tasks and user-specific keys inside mutation route handlers."
        },
        {
            title: "Benchmark API Latency with 3 Empirical Samples",
            desc: "Compare round-trip response times between direct MongoDB and in-memory cache."
        },
        {
            title: "Add GET /tasks/:id Dedicated Single-Task Cache",
            desc: "Supplementary Problem 1: Cache individual documents under task_<id> keys."
        }
    ];

    for (const t of tasksToAdd) {
        await page.type("#task-title", t.title);
        await page.type("#task-desc", t.desc);
        await page.click(".task-form button[type='submit']");
        await sleep(700);
    }

    // Step 3: Trigger a fresh uncached/bypass GET then standard GET to show Dashboard
    console.log("3. Capturing Dashboard Overview & Cache MISS...");
    await page.click("#toggle-bypass"); // Check bypass
    await sleep(300);
    await page.click(".lab-action-row button:first-child"); // GET /tasks
    await sleep(700);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_dashboard_overview.png") });

    // Step 4: Uncheck bypass and trigger GET /tasks to capture CACHE HIT
    console.log("4. Capturing CACHE HIT & Sub-millisecond Latency...");
    await page.click("#toggle-bypass"); // Uncheck bypass
    await sleep(300);
    // Click GET /tasks twice to ensure Cache HIT
    await page.click(".lab-action-row button:first-child");
    await sleep(500);
    await page.click(".lab-action-row button:first-child");
    await sleep(700);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_cache_hit_response.png") });

    // Step 5: Run 3-Sample Benchmark to capture comparison table
    console.log("5. Running Automated 3-Sample Latency Benchmark...");
    await page.click(".btn-benchmark");
    await sleep(2500); // Wait for 6 HTTP requests to finish
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_benchmark_comparison_table.png") });

    // Step 6: Inspect Single Task Caching Modal (Supplementary Problem 1)
    console.log("6. Inspecting Single Task Caching (GET /tasks/:id)...");
    const inspectButtons = await page.$$(".btn-action-pill");
    if (inspectButtons.length > 0) {
        await inspectButtons[0].click(); // First lookup (MISS or HIT)
        await sleep(500);
        await page.click(".modal-footer button"); // Close
        await sleep(300);
        await inspectButtons[0].click(); // Second lookup (Guaranteed HIT)
        await sleep(600);
        await page.screenshot({ path: path.join(OUTPUT_DIR, "04_single_task_cache_inspection.png") });
        await page.click(".modal-footer button");
        await sleep(300);
    }

    // Step 7: Capture Write Invalidation
    console.log("7. Capturing Write Invalidation on Task Creation...");
    await page.type("#task-title", "Verify Cache Eviction on Mutation");
    await page.type("#task-desc", "Demonstrating that POST /tasks immediately invalidates cached keys.");
    await page.click(".task-form button[type='submit']");
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_write_invalidation_after_create.png") });

    // Step 8: Capture Cache Debug Endpoint (/cache/stats) in browser
    console.log("8. Capturing Debug API Endpoint (/cache/stats)...");
    await page.goto(`${API_BASE}/cache/stats`, { waitUntil: "networkidle0" });
    await sleep(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_debug_cache_stats_endpoint.png") });

    await browser.close();
    console.log("All screenshots successfully captured in Practical 9 directory!");
}

capture().catch(err => {
    console.error("Screenshot capture failed:", err);
    process.exit(1);
});
