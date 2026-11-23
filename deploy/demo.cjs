const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");

const password = randomBytes(12).toString("base64url");
const port = process.env.BOARD_DEMO_PORT || "3100";
console.log("Class Board demo: http://localhost:" + port);
console.log("Teacher password for this demo session: " + password);
const next = require.resolve("next/dist/bin/next");
const server = spawn(process.execPath, [next, "dev", "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    BOARD_STORAGE: "local",
    BOARD_TEACHER_PASSWORD: password,
    BOARD_SESSION_SECRET: randomBytes(32).toString("hex"),
    BOARD_ORIGIN: "http://localhost:" + port,
  },
});
server.on("exit", (code) => { process.exitCode = code || 0; });
