/**
 * 网络错误检测工具
 *
 * 从后端返回的错误信息中提取 message 并判断是否是网络问题
 */

/**
 * 网络错误类型
 */
export enum NetworkErrorType {
  /** 网络连接失败 */
  CONNECTION_FAILED = 'connection_failed',
  /** 连接被拒绝（服务器未启动） */
  CONNECTION_REFUSED = 'connection_refused',
  /** 连接超时 */
  TIMEOUT = 'timeout',
  /** 无法路由到主机 */
  NO_ROUTE_TO_HOST = 'no_route_to_host',
  /** DNS 解析失败 */
  DNS_ERROR = 'dns_error',
  /** SSL/TLS 错误 */
  SSL_ERROR = 'ssl_error',
  /** 服务器错误（5xx） */
  SERVER_ERROR = 'server_error',
  /** 客户端错误（4xx） */
  CLIENT_ERROR = 'client_error',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 网络错误信息
 */
export interface NetworkErrorInfo {
  /** 错误类型 */
  type: NetworkErrorType;
  /** 是否是网络连接问题 */
  isNetworkIssue: boolean;
  /** 用户友好的错误描述 */
  message: string;
  /** 建议的解决方案 */
  suggestion?: string;
  /** 原始错误信息（来自后端） */
  originalError?: string;
}

/**
 * 从后端错误响应中提取 message
 *
 * 后端错误格式: API error (400 Bad Request): {"code":400,"message":"邮箱已注册","data":null}
 * 或者: API error (500): Internal Server Error
 *
 * @param errorString 后端返回的错误字符串
 * @returns 提取的 message 和原始错误
 */
export function extractMessageFromError(errorString: string): {
  message: string;
  originalError: string;
} {
  // 尝试匹配 API error (xxx): {...} 格式
  const apiErrorMatch = errorString.match(/API error \((\d+ [^\)]+)\): (.+)$/);

  if (apiErrorMatch) {
    const content = apiErrorMatch[2].trim();

    // 尝试解析 JSON 格式的错误
    if (content.startsWith('{') && content.endsWith('}')) {
      try {
        const errorJson = JSON.parse(content);
        if (errorJson.message) {
          return {
            message: errorJson.message,
            originalError: errorString,
          };
        }
      } catch (e) {
        // JSON 解析失败，使用原始内容
      }
    }

    // 使用 content 作为 message
    return {
      message: content,
      originalError: errorString,
    };
  }

  // 不是标准格式，直接使用原始错误
  return {
    message: errorString,
    originalError: errorString,
  };
}

/**
 * 判断错误是否是网络连接问题
 *
 * @param errorString 后端返回的错误字符串
 * @returns 网络错误信息
 */
export function analyzeNetworkError(errorString: string): NetworkErrorInfo {
  const lowerError = errorString.toLowerCase();
  const { message } = extractMessageFromError(errorString);

  // 检查是否是连接被拒绝
  if (
    lowerError.includes('connection refused') ||
    lowerError.includes('os error 10061') || // Windows: Connection refused
    lowerError.includes('os error 111')      // Linux: Connection refused
  ) {
    return {
      type: NetworkErrorType.CONNECTION_REFUSED,
      isNetworkIssue: true,
      message: '无法连接到服务器',
      suggestion: '请检查服务器是否运行，或确认服务器地址配置正确',
      originalError: message,
    };
  }

  // 检查是否是连接超时
  if (
    lowerError.includes('timeout') ||
    lowerError.includes('timed out') ||
    lowerError.includes('deadline has elapsed')
  ) {
    return {
      type: NetworkErrorType.TIMEOUT,
      isNetworkIssue: true,
      message: '连接超时',
      suggestion: '网络连接较慢或服务器响应超时，请检查网络连接',
      originalError: message,
    };
  }

  // 检查是否是无法路由到主机
  if (
    lowerError.includes('no route to host') ||
    lowerError.includes('os error 65') || // Windows: No route to host
    lowerError.includes('unreachable')
  ) {
    return {
      type: NetworkErrorType.NO_ROUTE_TO_HOST,
      isNetworkIssue: true,
      message: '无法访问服务器',
      suggestion: '请检查网络连接和服务器地址配置',
      originalError: message,
    };
  }

  // 检查是否是 DNS 解析失败
  if (
    lowerError.includes('dns') ||
    lowerError.includes('name resolution') ||
    lowerError.includes('unknown host')
  ) {
    return {
      type: NetworkErrorType.DNS_ERROR,
      isNetworkIssue: true,
      message: 'DNS 解析失败',
      suggestion: '请检查服务器地址是否正确，或检查 DNS 配置',
      originalError: message,
    };
  }

  // 检查是否是 SSL/TLS 错误
  if (
    lowerError.includes('ssl') ||
    lowerError.includes('tls') ||
    lowerError.includes('certificate')
  ) {
    return {
      type: NetworkErrorType.SSL_ERROR,
      isNetworkIssue: true,
      message: 'SSL/TLS 连接错误',
      suggestion: '请检查服务器证书配置',
      originalError: message,
    };
  }

  // 检查是否是连接失败（通用）
  if (
    lowerError.includes('error sending request') ||
    lowerError.includes('failed to connect') ||
    lowerError.includes('network unreachable') ||
    lowerError.includes('network is unreachable')
  ) {
    return {
      type: NetworkErrorType.CONNECTION_FAILED,
      isNetworkIssue: true,
      message: '网络连接失败',
      suggestion: '请检查网络连接和服务器状态',
      originalError: message,
    };
  }

  // 检查是否是服务器错误（5xx）
  if (lowerError.includes('api error (5')) {
    return {
      type: NetworkErrorType.SERVER_ERROR,
      isNetworkIssue: false,
      message: '服务器错误',
      suggestion: '服务器暂时不可用，请稍后重试',
      originalError: message,
    };
  }

  // 检查是否是客户端错误（4xx）
  if (lowerError.includes('api error (4')) {
    return {
      type: NetworkErrorType.CLIENT_ERROR,
      isNetworkIssue: false,
      message: '请求错误',
      suggestion: '请检查请求参数或联系管理员',
      originalError: message,
    };
  }

  // 未知错误
  return {
    type: NetworkErrorType.UNKNOWN,
    isNetworkIssue: false,
    message: '发生未知错误',
    suggestion: message,
    originalError: message,
  };
}

/**
 * 检查浏览器在线状态
 *
 * 注意：这只检查浏览器的网络状态，不保证能连接到服务器
 *
 * @returns 是否在线
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * 模拟网络错误（用于测试）
 *
 * @param errorType 要模拟的错误类型
 * @returns 模拟的错误字符串
 */
export function simulateNetworkError(errorType: NetworkErrorType): string {
  switch (errorType) {
    case NetworkErrorType.CONNECTION_REFUSED:
      return 'API error (500 Internal Server Error): error sending request for url (http://localhost:3000/api/sync): connection refused';
    case NetworkErrorType.TIMEOUT:
      return 'API error (500 Internal Server Error): error sending request for url (http://localhost:3000/api/sync): timeout';
    case NetworkErrorType.NO_ROUTE_TO_HOST:
      return 'API error (500 Internal Server Error): error sending request for url (http://localhost:3000/api/sync): no route to host';
    case NetworkErrorType.DNS_ERROR:
      return 'API error (500 Internal Server Error): error sending request for url (http://ocalhost:3000/api/sync): dns error';
    case NetworkErrorType.SERVER_ERROR:
      return 'API error (500): Internal Server Error';
    case NetworkErrorType.CLIENT_ERROR:
      return 'API error (400): {"code":400,"message":"邮箱已注册","data":null}';
    default:
      return 'API error (500): unknown error';
  };
}