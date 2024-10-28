module.exports = {
  apps: [{
    name: 'fn-class-viewer',
    script: 'build/index.js',
    interpreter: 'node@18.19.1',
    env: {
      NODE_ENV: 'development',
      PORT: 3500 // port the app will be launched on
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3500 // port the app will be launched on
    },
  }],
};
