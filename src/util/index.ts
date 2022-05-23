import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as fs from 'fs';

export const getCurrentEnvironment = () => {
  return process.env['MIDWAY_SERVER_ENV'] || process.env['NODE_ENV'] || 'prod';
};

export function isProduction(app) {
  return (
    app.getEnv() !== 'local' &&
    app.getEnv() !== 'unittest' &&
    app.getEnv() !== 'test'
  );
}

export function get(object: any, path: string): any {
  const keys = path.split('.');
  let result = object;

  keys.forEach(key => {
    result = result[key] ?? '';
  });

  return result;
}

//递归遍历文件并执行callback
export const fileDisplay = async function (
  filePath: string,
  callback: (fileName: string, filePath: string) => void
) {
  const files = await fsPromises.readdir(filePath);
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    //获取当前文件的绝对路径
    const filedir = path.join(filePath, filename);
    //根据文件路径获取文件信息，返回一个fs.Stats对象
    const stats = fs.statSync(filedir);
    if (stats.isFile()) {
      await callback(filename, filedir);
    } else if (stats.isDirectory()) {
      await fileDisplay(filedir, callback); //递归，如果是文件夹，就继续遍历该文件夹下面的文件
    }
  }
};
