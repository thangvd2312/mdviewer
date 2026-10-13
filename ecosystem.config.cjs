// pm2 config — production: one NestJS process serves the API (/api) and the built React app (frontend/dist).
//   npm run install:all && npm run build && pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'mdviewer',
      cwd: `${__dirname}/backend`,
      script: 'dist/main.js',
      node_args: '--env-file=../.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
