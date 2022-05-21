export * from './dist/index';

declare module '@midwayjs/core/dist/interface' {
  interface MidwayConfig {
    viteView?: {
      prod?: boolean;
      clientIndex?: Array<string>;
      entryServers?: Array<string>;
    };
  }
}
