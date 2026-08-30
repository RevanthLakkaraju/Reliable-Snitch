declare namespace Cloudflare {
  interface Env {
    SITE_ORIGIN?: string;
    DEMO_ACCESS_CODE_HASH?: string;
    DEMO_SESSION_SECRET?: string;
    FILES: R2Bucket;
  }
}
