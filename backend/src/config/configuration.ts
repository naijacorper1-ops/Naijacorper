// FRONTEND_URL may hold several addresses separated by commas, for example
// "http://localhost:5173,https://naijacorper.com". A trailing slash is
// removed because browsers never send one in the Origin header.
function parseOrigins(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '30', 10),
  },
  cors: {
    origins: parseOrigins(process.env.FRONTEND_URL),
  },
  cookie: {
    domain: process.env.COOKIE_DOMAIN,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromAddress: process.env.RESEND_FROM_ADDRESS,
  },
});
