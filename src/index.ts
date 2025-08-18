/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-18 10:32:11
 * @Description:  NPM包入口文件
 */
import graphic from './suroc/models/graphic';
import algorithm from './suroc/models/algorithm';
import setttings from './suroc/models/setttings';
import DrawTool from './suroc/models/drawTool';
import Creatunion from './suroc/situation/creatunion_v1.1.1_VUE';
import SurocSGP4 from './suroc/situation/SurocSGP4_v1.0.2';

let isInitialized = false;

// 异步 SHA256
async function sha256(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const buf = await window.crypto.subtle.digest('SHA-256', encoder.encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

// 获取唯一标识
async function getMachineId(): Promise<string> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const macs = Object.values(networkInterfaces)
      .flat()
      .filter(Boolean)
      .map((i) => (i as any).mac)
      .join('-');
    const cpu = os.cpus()[0].model;
    return sha256(cpu + macs);
  } else if (typeof window !== 'undefined') {
    // 浏览器
    const ua = navigator.userAgent;
    const screenInfo = `${screen.width}x${screen.height}`;
    return sha256(ua + screenInfo);
  } else {
    throw new Error('Unsupported environment');
  }
}

// 初始化
export async function init(token: string) {
  const machineId = await getMachineId();
  const tokenHash = await sha256(token);

  if (tokenHash !== machineId) {
    throw new Error('Invalid token for this machine');
  }

  isInitialized = true;
  console.log('CesiumUtils initialized successfully');
}

// 确保初始化
function ensureInit() {
  if (!isInitialized) {
    throw new Error('Please call init(token) before using CesiumUtils methods');
  }
}

// 包装模块函数
function wrapModule(module: any) {
  const wrapped: any = {};
  Object.keys(module).forEach((key) => {
    const value = module[key];
    if (typeof value === 'function') {
      wrapped[key] = async (...args: any[]) => {
        ensureInit();
        return value(...args);
      };
    } else {
      wrapped[key] = value;
    }
  });
  return wrapped;
}

// 最终导出
const CesiumUtils = {
  init,
  graphic: wrapModule(graphic),
  algorithm: wrapModule(algorithm),
  setttings: wrapModule(setttings),
  DrawTool: wrapModule(DrawTool),
  Creatunion: wrapModule(Creatunion),
  SurocSGP4: wrapModule(SurocSGP4),
};

export default CesiumUtils;
