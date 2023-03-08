declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_SECRET: string;
      REFRESH_SECRET: string;
      ENCRYPTION_KEY: string;
      NODE_ENV: "production" | "development" | "stage";
      PROXY_USER: string;
      PROXY_PASS: string;
      PROXY_TYPE: string;
      PROXY_TIMEOUT: string;
      PROXY_LOAD_LIMIT: string;
      DB_URI: string;
      POOL_SIZE: string;
      STEAM_RECONNECTS_RETRIES: string;
      STEAM_DOWN_RETRIES: string;
      STEAM_DOWN_INTERVAL: string;
      FARMING_INTERVAL_MINUTES: string;
      STEAM_USERNAME: string;
      STEAM_PASSWORD: string;
      STEAM_CODE: string;
      STEAM_WEBAPI: string;
      API_ADMIN_KEY: string;
      RECAPTCHA_SECRET: string;
      EMAIL_USER: string;
      EMAIL_PASS: string;
    }
  }
}

declare module "http" {
  interface IncomingMessage {
    body: { userId: ObjectId };
  }
}

interface GetCMListResponse {
  response: {
    serverlist: string[];
    serverlist_websockets: string[];
    result: number;
    message: string;
  };
}

interface GoogleRecaptchaResponse {
  success: boolean;
  "error-codes": string[];
}
