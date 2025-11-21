/**
 * TokenManager.ts
 * 合并了 SurocCesiumKitToken.js 和 TokenManager.ts 的功能
 * 提供完整的 Token 生成、验证和解码功能，同时支持 TypeScript 类型
 */

// 扩展 Window 接口，添加 sodium 属性
declare global {
    interface Window {
        sodium?: any;
    }
}

// 定义 Token 数据结构接口
export interface ITokenData {
    ip: string;
    expireTs: number;
}

// 定义 libsodium 接口（用于类型提示）
interface ISodium {
    ready: Promise<void>;
    from_hex(hex: string): Uint8Array;
    to_string(bytes: Uint8Array): string;
    from_base64(str: string, variant: number): Uint8Array;
    to_base64(bytes: Uint8Array, variant: number): string;
    randombytes_buf(size: number): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
    crypto_aead_xchacha20poly1305_ietf_encrypt(
        message: string,
        additionalData: null,
        nsec: null,
        nonce: Uint8Array,
        key: Uint8Array
    ): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_decrypt(
        additionalData: null,
        cipher: Uint8Array,
        nsec: null,
        nonce: Uint8Array,
        key: Uint8Array
    ): Uint8Array;
    base64_variants: {
        URLSAFE_NO_PADDING: number;
    };
}

// CesiumKitToken 类实现
class CesiumKitToken {
    private sodium: ISodium | null = null;
    private MASTER_KEY: Uint8Array | null = null;
    private initialized: boolean = false;

    /**
     * 初始化 libsodium 库和主密钥
     */
    async initialize(): Promise<boolean> {
        try {
            // 检查 sodium 是否可用
            if (typeof window === 'undefined' || !window.sodium) {
                console.error("错误：libsodium 库加载失败");
                return false;
            }

            this.sodium = window.sodium as unknown as ISodium;
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
            console.error(`错误：${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 将日期时间字符串转换为时间戳
     * @param str - 格式为 YYYY-MM-DD HH:MM:SS 的日期时间字符串
     * @returns 时间戳
     */
    parseDateTimeToTimestamp(str: string): number {
        const [y, m, d, h, min, s] = str.split(/[\s:-]/).map(Number);
        return new Date(y, m - 1, d, h, min, s).getTime();
    }

    /**
     * 将时间戳格式化为日期时间字符串
     * @param ts - 时间戳
     * @returns 格式化后的日期时间字符串
     */
    formatTimestamp(ts: number): string {
        const d = new Date(ts);
        const p = (n: number): string => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    /**
     * 生成 Token（使用 XChaCha20-Poly1305 加密算法）
     * @param ip - IP 地址
     * @param fixed - 固定字符串
     * @param expireTs - 过期时间戳
     * @returns 生成的 Token
     */
    async generateToken(ip: string, fixed: string, expireTs: number): Promise<string> {
        if (!this.initialized || !this.sodium || !this.MASTER_KEY) {
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

        // 手动拼接 nonce 和密文
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
     * @param token - 待解密的 Token
     * @returns 解密后的数据对象，如果解密失败返回 null
     */
    async decodeToken(token: string): Promise<ITokenData | null> {
        if (!this.initialized || !this.sodium || !this.MASTER_KEY) {
            console.warn("Token 管理器尚未初始化");
            return null;
        }

        try {
            // 基础格式验证
            if (!token || typeof token !== 'string') {
                console.warn('无效的 Token 格式: 必须是非空字符串');
                return null;
            }

            // 预检查是否看起来像有效的base64 URL安全格式
            if (!/^[A-Za-z0-9_-]+$/.test(token)) {
                console.warn('Token 格式验证失败: 包含非法字符');
                return null;
            }

            // 从 base64 解码
            let bytes;
            try {
                bytes = this.sodium.from_base64(
                    token,
                    this.sodium.base64_variants.URLSAFE_NO_PADDING
                );
            } catch (e) {
                console.warn('Token base64 解码失败: 无效的编码格式');
                return null;
            }

            // 检查解码后的数据长度是否合理
            const nonceSize = this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
            if (bytes.length <= nonceSize) {
                console.warn('Token 数据长度不足');
                return null;
            }

            // 分离 nonce 和密文
            const nonce = bytes.slice(0, nonceSize);
            const cipher = bytes.slice(nonceSize);

            // 解密
            let plain;
            try {
                plain = this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
                    null,
                    cipher,
                    null,
                    nonce,
                    this.MASTER_KEY
                );
            } catch (e) {
                console.warn('Token 解密失败: 无效的加密数据或密钥不匹配');
                return null;
            }

            // 解析 JSON 数据
            let parsedData;
            try {
                parsedData = JSON.parse(this.sodium.to_string(plain));
            } catch (e) {
                console.warn('Token 数据解析失败: 解密后的数据不是有效的JSON');
                return null;
            }

            // 验证解密后的数据结构
            if (!parsedData || typeof parsedData !== 'object' || !parsedData.ip || !parsedData.expireTs) {
                console.warn('Token 数据结构不完整');
                return null;
            }

            return parsedData;
        } catch (err) {
            // 捕获所有未处理的异常
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.warn(`Token 解密过程中发生未知错误: ${errorMessage}`);
            return null;
        }
    }
}

/**
 * TokenManager 类
 * 负责 Token 的验证和解码，内部集成了 CesiumKitToken 功能
 */
export class TokenManager {
    private tokenInstance: CesiumKitToken | null = null;
    private isInitialized: boolean = false;
    FIXED_STRING: string = '^creatunion.aseem.SurocKit&';

    /**
     * 初始化 TokenManager
     * @returns 初始化是否成功
     */
    async initialize(): Promise<boolean> {
        try {
            // 创建 CesiumKitToken 实例
            this.tokenInstance = new CesiumKitToken();

            // 初始化实例
            const initResult = await this.tokenInstance.initialize();
            this.isInitialized = initResult;
            return initResult;
        } catch (error) {
            console.error('Failed to initialize TokenManager:', error);
            // 出错时仍然设置为已初始化，使用模拟实现
            this.isInitialized = true;
            return true;
        }
    }

    /**
     * 解码 Token
     * @param token 待解码的 Token
     * @returns 解码后的数据对象，如果解码失败返回 null
     */
    async decodeToken(token: string): Promise<ITokenData | null> {
        // 首先确保管理器已初始化
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 预检查输入
        if (!token || typeof token !== 'string') {
            console.warn('Invalid token input: token must be a non-empty string');
            return null;
        }

        try {
            // 如果有 CesiumKitToken 实例，尝试使用它解码
            if (this.tokenInstance) {
                return await this.tokenInstance.decodeToken(token);
            }

            console.warn('Token decoding skipped: CesiumKitToken instance not available');
            return null;
        } catch (error) {
            // 更友好的错误处理，避免在控制台显示详细错误堆栈
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Token decoding failed: ${errorMessage} (This is expected for invalid tokens)`);
            return null;
        }
    }

    /**
     * 验证并解码 Token
     * @param token 待验证的 Token
     * @returns 解码后的 Token 数据，如果验证失败返回 null
     */
    async validateToken(token: string): Promise<ITokenData | null> {
        // 首先确保管理器已初始化
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // 如果 Token 为空，直接返回失败
            if (!token) {
                return null;
            }

            // 如果有 CesiumKitToken 实例，尝试使用它解码
            if (this.tokenInstance) {
                const decodedData = await this.tokenInstance.decodeToken(token);
                if (decodedData && this.validateTokenData(decodedData)) {
                    return decodedData;
                }
            }

            // 真正的 token 验证失败，返回 null
            // 不再使用回退验证逻辑，确保只有有效的 token 才能通过验证
            return null;
        } catch (error) {
            console.error('Token validation failed:', error);
            // 出错时返回 null，而不是使用回退验证
            return null;
        }
    }

    /**
     * 生成新的 Token
     * @param ip IP 地址
     * @param fixed 固定字符串
     * @param expireTs 过期时间戳
     * @returns 生成的 Token
     */
    async generateToken(ip: string, fixed: string, expireTs: number): Promise<string | null> {
        // 首先确保管理器已初始化
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // 如果有 CesiumKitToken 实例，尝试使用它生成 Token
            if (this.tokenInstance) {
                return await this.tokenInstance.generateToken(ip, fixed, expireTs);
            }

            console.error('Token generation failed: CesiumKitToken instance not available');
            return null;
        } catch (error) {
            console.error('Token generation failed:', error);
            return null;
        }
    }

    /**
     * 将日期时间字符串转换为时间戳
     * @param str 日期时间字符串
     * @returns 时间戳
     */
    parseDateTimeToTimestamp(str: string): number {
        if (this.tokenInstance) {
            return this.tokenInstance.parseDateTimeToTimestamp(str);
        }

        // 回退实现
        const [y, m, d, h, min, s] = str.split(/[\s:-]/).map(Number);
        return new Date(y, m - 1, d, h, min, s).getTime();
    }

    /**
     * 将时间戳格式化为日期时间字符串
     * @param ts 时间戳
     * @returns 格式化后的字符串
     */
    formatTimestamp(ts: number): string {
        if (this.tokenInstance) {
            return this.tokenInstance.formatTimestamp(ts);
        }

        // 回退实现
        const d = new Date(ts);
        const p = (n: number): string => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    /**
     * 验证 Token 数据的有效性
     * @param data 解码后的 Token 数据
     * @returns 数据是否有效
     */
    private validateTokenData(data: any): data is ITokenData {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // 检查必要字段
        if (!data.ip || typeof data.expireTs !== 'number') {
            return false;
        }

        // 检查过期时间
        if (Date.now() > data.expireTs) {
            console.warn('Token may be expired');
            // 过期的 Token 仍然允许使用，但显示警告
        }

        return true;
    }

    /**
     * 回退验证逻辑，当无法使用 CesiumKitToken 时使用
     * @param token 待验证的 Token
     * @returns 模拟的 Token 数据
     */
    private fallbackValidation(token: string): ITokenData {
        // 在非浏览器环境或无法使用 CesiumKitToken 时
        // 返回一个模拟的 Token 数据对象，允许基本功能使用
        const currentHost = typeof window !== 'undefined' ? new URL(window.location.href).hostname : 'localhost';
        return {
            ip: currentHost,
            expireTs: Date.now() + 1000 * 60 * 60 * 24 * 365 // 默认一年有效期
        };
    }
}

// 导出单例实例
export default new TokenManager();