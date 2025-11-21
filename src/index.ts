/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-20 10:00:00
 * @Description:  NPM包入口文件（使用 SurocCesiumKitToken 进行 Token 验证）
 */

// 扩展全局窗口接口，添加 CesiumKitToken 支持
declare global {
  interface Window {
    CesiumKitToken?: new () => {
      initialize: () => Promise<boolean>;
      decodeToken: (token: string) => Promise<any>;
      generateToken: (ip: string, fixed: string, expireTs: number) => Promise<string>;
    };
  }
}

import DrawTool from './drawtool';
import settings from './settings';
import { SurocSGP4, Slab, Sgp4, Elements, ResonanceState, Constants, Bindings } from './SurocSGP4_v1.0.5';
import surocSGP4 from './SurocSGP4_v1.0.5';
import tokenManager from './TokenManager';

let isInitialized = false;

/**
 * 自定义消息提示函数 - 创建动态HTML提示元素
 * @param message 提示消息
 * @param type 提示类型：'error'（红色）或 'warning'（黄色）
 * @returns null
 */
function showErrorMessage(message: string, type: 'error' | 'warning' = 'error') {
  // 如果是浏览器环境，使用更优雅的提示方式
  if (typeof window !== 'undefined') {
    // 创建动态提示元素
    createNotification(message, type);
  }

  // 根据类型输出不同级别的日志
  if (type === 'error') {
    console.error('Cesium-Suroc-Kit: ' + message);
  } else {
    console.warn('Cesium-Suroc-Kit: ' + message);
  }

}

// 辅助函数：创建和包装模块，防止未初始化调用
function wrapModule(module: any) {
  const wrapped: any = {};
  Object.keys(module).forEach((key) => {
    const value = module[key];
    if (typeof value === 'function') {
      wrapped[key] = (...args: any[]) => {
        if (!isInitialized) {
          showErrorMessage('请先调用 init(token)');
          return;
        }
        return value(...args);
      };
    } else {
      wrapped[key] = value;
    }
  });
  return wrapped;
}

/**
 * 创建动态通知元素
 * @param message 通知内容
 * @param type 通知类型：'error'（红色）或 'warning'（黄色）
 * @param duration 显示时长（毫秒）
 */
function createNotification(message: string, type: 'error' | 'warning' = 'error', duration: number = 3000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // 创建提示容器
  const notification = document.createElement('div');

  // 根据通知类型设置样式
  const backgroundColor = type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(234, 179, 8, 0.9)';
  const icon = type === 'error' ? '⚠️' : '⚠️';
  const borderLeft = type === 'error' ? '4px solid #ef4444' : '4px solid #f59e0b';

  // 设置样式和内容
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${backgroundColor};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    border-left: ${borderLeft};
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 99999999999999999999999999999999999999999999999;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  // 创建图标元素
  const iconElement = document.createElement('span');
  iconElement.textContent = icon;
  iconElement.style.fontSize = '20px';
  iconElement.style.lineHeight = '1';

  // 创建文本元素
  const textElement = document.createElement('span');
  textElement.textContent = message;
  textElement.style.flex = '1';
  textElement.style.lineHeight = '1.5';

  // 添加元素到通知容器
  notification.appendChild(iconElement);
  notification.appendChild(textElement);

  // 添加到文档
  document.body.appendChild(notification);

  // 触发显示动画
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);

  // 设置自动移除
  setTimeout(() => {
    // 淡出动画
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    notification.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';

    // 动画结束后移除元素
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// 初始化 token 并返回模块（加入 TokenManager 解密验证）
let init = async (token: string) => {
  try {
    //  *  1. 初始化 TokenManager 并尝试解密 token
    const ok = await tokenManager.initialize();
    if (!ok) {
      return showErrorMessage("TokenManager 初始化失败");
    }

    // 使用 TokenManager 尝试解密
    const decoded: any = await tokenManager.validateToken(token);

    if (!decoded) {
      return showErrorMessage("无效的 Token：解密失败或数据格式不正确");
    }

    // Token 数据
    const { ip, fixed, expireTs } = decoded;
    // 获取当前网页的 IP/Host
    const currentHost = window.location.host;

    // IP 校验（保证 Token 中的 IP 必须与访问地址一致）
    if (ip !== currentHost) {
      return showErrorMessage(`IP 校验失败: ，当前访问 ${currentHost} IP未授权`);
    }

    // 过期检查
    if (Date.now() > expireTs) {
      return showErrorMessage("Cesium-Suroc-Kit: 令牌已过期");
    }

    // 2.TokenManager 解密成功
    isInitialized = true;

    // 包装模块，防止未初始化调用
    function wrapModule(module: any) {
      const wrapped: any = {};
      Object.keys(module).forEach((key) => {
        const value = module[key];
        if (typeof value === 'function') {
          wrapped[key] = (...args: any[]) => {
            if (!isInitialized) {
              showErrorMessage('请先调用 init(token)');
              return;
            }
            return value(...args);
          };
        } else {
          wrapped[key] = value;
        }
      });
      return wrapped;
    }

    // 3. 返回模块 + TokenManager 实例
    return {
      ...wrapModule(settings),
      ...wrapModule(surocSGP4),
      DrawTool,
      SurocSGP4,
      Slab,
      Sgp4,
      Elements,
      ResonanceState,
      Constants,
      Bindings,
    };

  } catch (err: any) {
    return showErrorMessage("Token 验证失败: " + err.message);
  }
};



const SurocKit = { init };

export default SurocKit;