/**
 * CesiumKitToken 类
 * 用于生成和验证 Cesium Kit 的访问令牌
 */
class CesiumKitToken {
  constructor() {
    this.sodium = null;
    this.MASTER_KEY = null;
    this.initialized = false;
  }

  /**
   * 初始化 libsodium 库和主密钥
   */
  async initialize() {
    try {
      // 检查 sodium 是否可用
      if (!window.sodium) {
        console.error("错误：libsodium 库加载失败");
        return false;
      }

      this.sodium = window.sodium;
      await this.sodium.ready;

      try {
        // 初始化密钥
        this.MASTER_KEY = this.sodium.from_hex(
          "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
        );
      } catch (keyError) {
        console.error("密钥初始化失败:", keyError);
        console.error("错误：密钥初始化失败");
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("libsodium 初始化失败:", error);
      console.error(`错误：${error.message}`);
      return false;
    }
  }

  /**
   * 将日期时间字符串转换为时间戳
   * @param {string} str - 格式为 YYYY-MM-DD HH:MM:SS 的日期时间字符串
   * @returns {number} 时间戳
   */
  parseDateTimeToTimestamp(str) {
    const [y, m, d, h, min, s] = str.split(/[\s:-]/).map(Number);
    return new Date(y, m - 1, d, h, min, s).getTime();
  }

  /**
   * 将时间戳格式化为日期时间字符串
   * @param {number} ts - 时间戳
   * @returns {string} 格式化后的日期时间字符串
   */
  formatTimestamp(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /**
   * 生成 Token（使用 XChaCha20-Poly1305 加密算法）
   * @param {string} ip - IP 地址
   * @param {string} fixed - 固定字符串
   * @param {number} expireTs - 过期时间戳
   * @returns {Promise<string>} 生成的 Token
   */
  async generateToken(ip, fixed, expireTs) {
    if (!this.initialized) {
      throw new Error("Token 管理器尚未初始化");
    }

    const payload = JSON.stringify({ ip, fixed, expireTs });

    // 生成随机 nonce
    const nonce = this.sodium.randombytes_buf(
      this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
    );

    // 使用 XChaCha20-Poly1305 算法加密
    const cipher = this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      payload,
      null,
      null,
      nonce,
      this.MASTER_KEY
    );

    // 手动拼接 nonce 和密文（替代不存在的 this.sodium.concat）
    const tokenBytes = new Uint8Array(nonce.length + cipher.length);
    tokenBytes.set(nonce, 0);
    tokenBytes.set(cipher, nonce.length);
    return this.sodium.to_base64(
      tokenBytes,
      this.sodium.base64_variants.URLSAFE_NO_PADDING
    );
  }

  /**
   * 解密 Token
   * @param {string} token - 待解密的 Token
   * @returns {Promise<Object|null>} 解密后的数据对象，如果解密失败返回 null
   */
  async decodeToken(token) {
    if (!this.initialized) {
      console.error("Token 管理器尚未初始化");
      return null;
    }

    try {
      // 基础格式验证
      if (!token || typeof token !== 'string') {
        throw new Error('无效的 Token 格式');
      }

      // 从 base64 解码
      const bytes = this.sodium.from_base64(
        token,
        this.sodium.base64_variants.URLSAFE_NO_PADDING
      );

      // 检查解码后的数据长度是否合理
      const nonceSize = this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
      if (bytes.length <= nonceSize) {
        throw new Error('Token 数据长度不足');
      }

      // 分离 nonce 和密文
      const nonce = bytes.slice(0, nonceSize);
      const cipher = bytes.slice(nonceSize);

      // 解密
      const plain = this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        cipher,
        null,
        nonce,
        this.MASTER_KEY
      );

      // 解析 JSON 数据
      const parsedData = JSON.parse(this.sodium.to_string(plain));

      // 验证解密后的数据结构
      if (!parsedData.ip || !parsedData.expireTs) {
        throw new Error('Token 数据结构不完整');
      }

      return parsedData;
    } catch (err) {
      console.error("Token 解密失败:", err);
      return null;
    }
  }
}

// 导出类以便在其他文件中使用
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = CesiumKitToken;
} else {
  // 浏览器环境，挂载到 window 对象
  window.CesiumKitToken = CesiumKitToken;
}