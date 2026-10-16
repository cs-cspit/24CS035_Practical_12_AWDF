// Automated test suite for Practical 7 Authentication & Middleware Pipeline
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();

const BASE_URL = "http://localhost:5000";

async function runTests() {
    console.log("=== STARTING PRACTICAL 7 VERIFICATION TESTS ===");
    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}`);
            failed++;
        }
    }

    const testUser = {
        name: "Samarth Kalavadia",
        email: `testuser_${Date.now()}@charusat.edu.in`,
        password: "TestPassword123!"
    };

    let authToken = "";

    try {
        // Test 1: Check server health
        const resHealth = await fetch(`${BASE_URL}/health`);
        assert(resHealth.status === 200, "1. Server is healthy (GET /health -> 200)");

        // Test 2: Access protected route without token (Must return 401)
        const resNoToken = await fetch(`${BASE_URL}/tasks`);
        const jsonNoToken = await resNoToken.json();
        assert(resNoToken.status === 401 && jsonNoToken.message.includes("Access denied"), "2. Access /tasks without token returns 401 Unauthorized");

        // Test 3: Access protected route with malformed token (Must return 401)
        const resBadToken = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: "Bearer invalid_garbage_token" }
        });
        assert(resBadToken.status === 401, "3. Access /tasks with invalid token returns 401 Unauthorized");

        // Test 4: Register new user (POST /auth/register -> 201)
        const resReg = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testUser)
        });
        const jsonReg = await resReg.json();
        assert(resReg.status === 201 && jsonReg.token && jsonReg.user.email === testUser.email.toLowerCase(), "4. Register user creates document with hashed password & returns 201 with JWT");

        // Test 5: Register with duplicate email (Must reject 400)
        const resDup = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testUser)
        });
        assert(resDup.status === 400, "5. Duplicate email registration rejected with 400 Bad Request");

        // Test 6: Register with short password (Must reject 400)
        const resShortPass = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: `short_${Date.now()}@test.com`, password: "123" })
        });
        assert(resShortPass.status === 400, "6. Password shorter than 6 chars rejected with 400 Bad Request");

        // Test 7: Login with incorrect password (Must reject 401)
        const resWrongPass = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: testUser.email, password: "WrongPassword!" })
        });
        assert(resWrongPass.status === 401, "7. Login with incorrect password rejected with 401 Unauthorized");

        // Test 8: Login with valid credentials (POST /auth/login -> 200 & JWT)
        const resLogin = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: testUser.email, password: testUser.password })
        });
        const jsonLogin = await resLogin.json();
        assert(resLogin.status === 200 && jsonLogin.token, "8. Login with valid credentials succeeds (200 OK & returns signed JWT)");
        authToken = jsonLogin.token;

        // Test 9: Access /me endpoint with valid token (Supplementary Problem)
        const resMe = await fetch(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const jsonMe = await resMe.json();
        assert(resMe.status === 200 && jsonMe.user.email === testUser.email.toLowerCase() && jsonMe.user.password === undefined, "9. GET /auth/me returns logged-in user details without exposing password");

        // Test 10: Access root /me alias
        const resRootMe = await fetch(`${BASE_URL}/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(resRootMe.status === 200, "10. GET /me alias works seamlessly");

        // Test 11: Validation Middleware - Reject task creation with missing/empty title (POST /tasks)
        const resEmptyTask = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ title: "   ", description: "Empty title test" })
        });
        const jsonEmptyTask = await resEmptyTask.json();
        assert(resEmptyTask.status === 400 && jsonEmptyTask.message.includes("Validation error"), "11. Validation Middleware rejects empty title with 400 Bad Request before database");

        // Test 12: Create task with valid title and token (POST /tasks -> 201)
        const resCreateTask = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: "Complete Practical 7 Authentication Lab",
                description: "Implement JWT, bcrypt, and middleware pipeline"
            })
        });
        const jsonCreateTask = await resCreateTask.json();
        assert(resCreateTask.status === 201 && jsonCreateTask.task._id, "12. Create task succeeded with auth & validation pipeline (201 Created)");
        const createdTaskId = jsonCreateTask.task?._id;

        // Test 13: Fetch protected tasks (GET /tasks -> 200)
        const resGetTasks = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const jsonGetTasks = await resGetTasks.json();
        assert(resGetTasks.status === 200 && Array.isArray(jsonGetTasks) && jsonGetTasks.some(t => t._id === createdTaskId), "13. GET /tasks retrieves tasks for authenticated user");

        // Test 14: Update task (PUT /tasks/:id -> 200)
        const resUpdate = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ completed: true })
        });
        const jsonUpdate = await resUpdate.json();
        assert(resUpdate.status === 200 && jsonUpdate.task.completed === true, "14. PUT /tasks/:id updates task status to completed");

        // Test 15: Delete task (DELETE /tasks/:id -> 200)
        const resDelete = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(resDelete.status === 200, "15. DELETE /tasks/:id successfully deletes task");

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    }

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) process.exit(1);
}

runTests();
