/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-20 10:00:00
 * @Description:  NPM包入口文件（仅保留 IP / 固定字符串 / 过期时间 三个字段校验）
 */

import settings from './settings';
// import drawtool from './drawtool';

let isInitialized = false;
const FIXED_STRING = '^creatunion.aseem.SurocKit&';

// 初始化 token 并返回模块
let init = (token: string) => {
  try {
    const decoded = atob(token);
    const parts = decoded.split('|');

    if (parts.length !== 4) throw new Error('Token 格式错误');

    const [hashIgnored, tokenIp, fixed, expireTsStr] = parts; // hash字段忽略
    const expireTs = Number(expireTsStr);
    if (isNaN(expireTs)) throw new Error('过期时间无效');

    // 固定字符串检查
    if (fixed !== FIXED_STRING) throw new Error('固定字符不匹配');

    // 过期检查
    if (Date.now() > expireTs) throw new Error('Token 已过期');

    // URL IP 与端口验证
    let urlIp = '';
    let urlPort = '';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      urlIp = url.hostname;
      urlPort = url.port; // 没有端口则为空字符串
    }

    // token 可能带端口
    let tIp = tokenIp;
    let tPort = '';
    if (tokenIp.includes(':')) [tIp, tPort] = tokenIp.split(':');

    if (urlPort) {
      if (urlIp !== tIp || urlPort !== tPort) throw new Error(`Token IP/端口 与 URL 不匹配: ${tokenIp} !== ${urlIp}:${urlPort}`);
    } else {
      if (urlIp !== tIp) throw new Error(`Token IP 与 URL IP 不匹配: ${tokenIp} !== ${urlIp}`);
    }

    isInitialized = true;

    // 包装模块，防止未初始化调用
    function wrapModule(module: any) {
      const wrapped: any = {};
      Object.keys(module).forEach((key) => {
        const value = module[key];
        if (typeof value === 'function') {
          wrapped[key] = (...args: any[]) => {
            if (!isInitialized) throw new Error('请先调用 init(token)');
            return value(...args);
          };
        } else {
          wrapped[key] = value;
        }
      });
      return wrapped;
    }

    return {
      ...wrapModule(settings),
      // ...wrapModule(drawtool),
    };
  } catch (err: any) {
    throw new Error('Token 验证失败: ' + err.message);
  }
}
const SurocKit = { init };

export default SurocKit;
