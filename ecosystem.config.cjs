module.exports = {
  apps: [
    {
      name: "pansa-gateway",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
      },
      max_memory_restart: "1G",
      autorestart: true,
      watch: false,
    },
  ],
};
