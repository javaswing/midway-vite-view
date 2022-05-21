export const getCurrentEnvironment = () => {
  return process.env['MIDWAY_SERVER_ENV'] || process.env['NODE_ENV'] || 'prod';
};

export function isProduction(app) {
  return app.getEnv() !== 'local' && app.getEnv() !== 'unittest';
}
