import { App, Config, Inject, Provide } from '@midwayjs/decorator';
import { Application, Context } from '@midwayjs/koa';
import { StaticFileOptions } from '@midwayjs/static-file';
import { IViewEngine, RenderOptions } from '@midwayjs/view';
import * as fs from 'fs';
import * as path from 'path';
import { basename } from 'path';
import type { ViteDevServer } from 'vite';
import { ViteViewOptions } from '../interface';
import { isProduction } from '../util';
import { createVite } from '../vite';

@Provide()
export class viteView implements IViewEngine {
  @Config('staticFile')
  staticFileConfig: StaticFileOptions;

  @Config('viteView')
  viteViewConfig: ViteViewOptions;

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
        template = fs.readFileSync(indexName, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
      } else {
        template = fs.readFileSync(indexName, 'utf-8');
        manifest = require(this.staticFileConfig.dirs.default.dir +
          '/html/client/ssr-manifest.json');
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
    if (this.viteViewConfig.prod !== undefined) {
      this.prod = this.viteViewConfig.prod;
    } else {
      this.prod = isProduction(this.app);
    }

    // midwayjs view 插件默认的rootDir为根目录的 view
    if (!this.prod) {
      locals.entry = locals.entry
        ? path.resolve(options.root, locals.entry)
        : undefined;
      tpl = path.resolve(options.root, tpl);
    }

    if (this.prod) {
      this.prodPath = this.staticFileConfig.dirs.default.dir + '/html';
      tpl = path.join(
        this.prodPath, // 这里暂时只能写死为static的文件夹，没有办法和 vite-view build 相关的参数同步
        '/client',
        basename(tpl)
      );
      locals.entry = this.getDishEntryServerUrl(locals.entry);
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

  private async getRender(vite: ViteDevServer, entryServerUrl: string) {
    if (!this.prod) return (await vite.ssrLoadModule(entryServerUrl)).render;
    else {
      const entryServerConfig = entryServerUrl.replace(/\.[jt]sx$/, '.js');
      return require(entryServerConfig).render;
    }
  }

  private getDishEntryServerUrl(entryStr: string) {
    if (entryStr) {
      const entryName = basename(entryStr).replace(/\.[jt]sx$/, '.js');
      return path.join(this.prodPath, '/server', entryName);
    }
    return undefined;
  }
}
