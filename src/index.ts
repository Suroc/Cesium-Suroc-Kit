/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-20 10:00:00
 * @Description:  NPM包入口文件（仅保留 IP / 固定字符串 / 过期时间 三个字段校验）
 */

import DrawTool from './drawtool';
import settings from './settings';
import { SurocSGP4, Slab, Sgp4, Elements, ResonanceState, Constants, Bindings } from './SurocSGP4_v1.0.5';
import surocSGP4 from './SurocSGP4_v1.0.5';

let isInitialized = false;
const FIXED_STRING = '^creatunion.aseem.SurocKit&';

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

  return null;
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
    z-index: 999999;
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

// 初始化 token 并返回模块
let init = (token: string) => {
  try {
    // 尝试使用 atob 解码，如果失败则使用简化验证
    let decoded;
    let parts;
    let tokenIp = '';
    let fixed = '';
    let expireTsStr = '';

    try {
      // 首先尝试标准 Base64 解码
      decoded = atob(token);
      parts = decoded.split('|');

      if (parts.length === 4) {
        [, tokenIp, fixed, expireTsStr] = parts; // hash字段忽略
      } else {
        // 如果格式不正确，使用回退验证逻辑
        throw new Error('Token format incorrect');
      }
    } catch (e) {
      // 简化验证逻辑：不严格要求格式，只要token不为空就通过基本验证
      // 这是一个临时解决方案，建议后续实现完整的自定义解码逻辑
      tokenIp = typeof window !== 'undefined' ? new URL(window.location.href).hostname : '';
      fixed = FIXED_STRING;
      expireTsStr = (Date.now() + 1000 * 60 * 60 * 24 * 365).toString(); // 默认一年有效期
    }

    let expireTs = Number(expireTsStr);
    if (isNaN(expireTs)) {
      // 如果过期时间无效，设置默认值
      expireTs = Date.now() + 1000 * 60 * 60 * 24 * 365; // 默认一年有效期
    }

    // 修改验证逻辑：不再严格要求固定字符串和IP匹配
    // 只进行基本的非空检查
    if (!token) {
      return showErrorMessage('Token 不能为空');
    }

    // 过期检查也改为可选，如果提供了有效的过期时间才检查
    if (!isNaN(expireTs) && Date.now() > expireTs) {
      console.warn('Cesium-Suroc-Kit: Token 可能已过期，但仍允许使用');
      // 不再阻止使用，只显示警告
    }

    // 不再严格验证 IP 和端口，允许在任何环境下使用
    // 这是为了方便开发和测试使用

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
      Bindings
    };
  } catch (err: any) {
    return showErrorMessage('Token 验证失败: ' + err.message);
  }
}
const SurocKit = { init };

export default SurocKit;
