const { spawn } = require("node:child_process");

const port = process.env.BOARD_DEMO_PORT || "3100";
console.log("Class Board demo: http://localhost:" + port);
const next = require.resolve("next/dist/bin/next");
const server = spawn(process.execPath, [next, "dev", "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    BOARD_STORAGE: "local",
    BOARD_ORIGIN: "http://localhost:" + port,
  },
});
server.on("exit", (code) => { process.exitCode = code || 0; });
