import { App, Config, Inject, Provide } from '@midwayjs/decorator';
import { Application, Context } from '@midwayjs/koa';
import { IViewEngine, RenderOptions } from '@midwayjs/view';
import * as fs from 'fs';
import * as path from 'path';
import type { ViteDevServer } from 'vite';
import { isProduction } from '../util';
import { createVite } from '../vite';

@Provide()
export class viteView implements IViewEngine {
  @Config('staticFile')
  staticFileConfig;

  @Config('viteView')
  viteViewConfig;

  @App()
  app: Application;

  @Inject()
  ctx: Context;

  private prodPath: string;
  private prod: boolean;

  async getSsrHtml(
    indexName: string,
    entryServerUrl: string,
    url: string,
    assign: object | undefined
  ) {
    const vite = await createVite();
    try {
      let manifest = {};
      let template;
      const render = await this.getRender(vite, entryServerUrl);
      if (!this.prod) {
        // always read fresh template in dev
        template = await vite.transformIndexHtml(url, template);
      } else {
        template = fs.readFileSync(indexName, 'utf-8');
        manifest = require(this.staticFileConfig.dirs.default.dir +
          '/html/ssr-manifest.json');
      }

      const [appHtml, preloadLinks] = await render(url, manifest);
      let html = template
        .replace('<!--preload-links-->', preloadLinks)
        .replace('<!--app-html-->', appHtml)
        .replace('<html', '<html data-ssr="true"');
      if (assign) {
        for (const [key, value] of Object.entries(assign)) {
          html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
      }
      return html;
    } catch (e) {
      vite && vite.ssrFixStacktrace(e);
      console.error('服务端渲染失败，执行客户端渲染逻辑', e);
      return await this.getClientHtml(indexName, assign);
    }
  }

  async getClientHtml(indexName, assign: object | undefined) {
    let html = fs
      .readFileSync(indexName, 'utf-8')
      .replace('<!--preload-links-->', '')
      .replace('<!--app-html-->', '');
    if (assign) {
      for (const [key, value] of Object.entries(assign)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
    return html;
  }

  async render(
    name: string,
    locals?: Record<string, any>,
    options?: RenderOptions
  ) {
    return (locals.ctx.body = await this.renderString(name, locals, options));
  }

  async renderString(
    tpl: string,
    locals?: Record<string, any>,
    options?: RenderOptions
  ) {
    tpl = path.resolve(options.root, tpl);
    if (this.viteViewConfig.prod !== undefined) {
      this.prod = this.viteViewConfig.prod;
    } else {
      this.prod = isProduction(this.app);
    }

    locals.entry = locals.entry
      ? path.resolve(options.root, locals.entry)
      : undefined;
    if (this.prod) {
      this.prodPath = this.staticFileConfig.dirs.default.dir + '/html';
      tpl = path.resolve(this.prodPath, tpl.slice(options.root.length + 1));
      locals.entry = locals.entry
        ? path.resolve(
            this.prodPath,
            locals.entry.slice(options.root.length + 1)
          )
        : undefined;
    }

    if (locals.entry) {
      return (locals.ctx.body = await this.getSsrHtml(
        tpl,
        locals.entry,
        locals.ctx.originalUrl,
        locals['assign']
      ));
    }
    return (locals.ctx.body = await this.getClientHtml(tpl, locals['assign']));
  }

  // private hasPlugin(plugins: readonly Plugin[] = [], name: string): boolean {
  //   return !!plugins
  //     .flat()
  //     .find(plugin => (plugin.name || '').startsWith(name));
  // }

  private async getRender(vite: ViteDevServer, entryServerUrl: string) {
    if (!this.prod) return (await vite.ssrLoadModule(entryServerUrl)).render;
    else {
      // const plugins = vite.config.plugins;
      // const isReact =
      //   this.hasPlugin(plugins, 'vite:react') ||
      //   this.hasPlugin(plugins, 'react-refresh');
      const entryServerConfig = entryServerUrl.replace(/\.[jt]sx$/, '.js');
      return require(entryServerConfig).render;
    }
  }
}
