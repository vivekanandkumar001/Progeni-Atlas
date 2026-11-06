/**
 * Progeni Atlas — Companion Utility Functions
 * Pure helper functions for in-app browser detection, secure context checks,
 * and redemption/media error classification.
 */

export interface ErrorClassification {
  title: string;
  message: string;
  isExpiredOrUsed: boolean;
  canRetry: boolean;
}

/**
 * Detects whether the current browser environment is an embedded WebView / In-App Browser
 * (e.g. Instagram, WhatsApp, Facebook, Line, TikTok, generic Android WebView)
 * where camera/mic WebRTC constraints frequently fail or permissions are silently dropped.
 */
export function isInAppBrowser(userAgent: string): boolean {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }

  const ua = userAgent.toLowerCase();

  // Known social in-app browser signatures
  const inAppPatterns = [
    'instagram',
    'fban',
    'fbav',
    'fb_iab',
    'whatsapp',
    'line/',
    'micromessenger',
    'wechat',
    'twitter',
    'snapchat',
    'tiktok',
    'bytedance',
    'linkedinapp',
    'threads',
  ];

  for (const pattern of inAppPatterns) {
    if (ua.includes(pattern)) {
      return true;
    }
  }

  // Android generic WebView detection:
  // Android WebViews usually include "Version/4.0 Chrome/" or "; wv)" or "WebView"
  if (ua.includes('android')) {
    if (ua.includes('; wv)') || ua.includes('version/4.0') || ua.includes('webview')) {
      return true;
    }
  }

  // iOS generic UIWebView / WKWebView detection without Safari
  // (e.g. AppleWebKit and Mobile present, but missing Safari or using specific WKWebView tokens)
  if ((ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) && !ua.includes('safari')) {
    if (ua.includes('applewebkit')) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a human-friendly name for the detected in-app browser if known.
 */
export function getInAppBrowserName(userAgent: string): string | null {
  if (!userAgent || typeof userAgent !== 'string') {
    return null;
  }

  const ua = userAgent.toLowerCase();
  if (ua.includes('instagram')) return 'Instagram';
  if (ua.includes('whatsapp')) return 'WhatsApp';
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) return 'Facebook';
  if (ua.includes('line/')) return 'Line';
  if (ua.includes('micromessenger') || ua.includes('wechat')) return 'WeChat';
  if (ua.includes('twitter')) return 'Twitter / X';
  if (ua.includes('snapchat')) return 'Snapchat';
  if (ua.includes('tiktok') || ua.includes('bytedance')) return 'TikTok';
  if (ua.includes('linkedinapp')) return 'LinkedIn';
  if (ua.includes('threads')) return 'Threads';
  if (isInAppBrowser(userAgent)) return 'In-App Browser';

  return null;
}

/**
 * Checks whether the current context satisfies the Secure Context requirement
 * (HTTPS or localhost/127.0.0.1) needed for MediaDevices / WebRTC camera & mic access.
 */
export function checkIsSecureContext(ctx?: {
  isSecureContext?: boolean;
  protocol?: string;
  hostname?: string;
}): boolean {
  if (ctx) {
    if (typeof ctx.isSecureContext === 'boolean') {
      return ctx.isSecureContext;
    }
    const proto = ctx.protocol || '';
    const host = ctx.hostname || '';
    if (proto === 'https:') return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    return false;
  }

  if (typeof window !== 'undefined') {
    if (typeof window.isSecureContext === 'boolean') {
      return window.isSecureContext;
    }
    const proto = window.location.protocol;
    const host = window.location.hostname;
    if (proto === 'https:') return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    return false;
  }

  return true; // Default fallback for SSR
}

/**
 * Classifies HTTP errors and WebRTC capture errors into clear, candidate-facing instructions.
 */
export function classifyCompanionError(
  status: number | null,
  rawMessage?: string
): ErrorClassification {
  const msg = (rawMessage || '').toLowerCase();

  // 1. Token redemption errors. Match only pairing-token phrasing — a bare
  // "token" substring would also swallow unrelated failures (e.g. a LiveKit
  // token error) and dead-end them as unrecoverable.
  const isPairingTokenError =
    msg.includes('invalid or expired') ||
    msg.includes('pairing token') ||
    msg.includes('expired token') ||
    msg.includes('invalid token') ||
    msg.includes('token expired') ||
    msg.includes('token is invalid');
  if (status === 404 || isPairingTokenError) {
    return {
      title: 'Pairing Code Expired or Used',
      message: 'This QR code is either expired, already redeemed, or invalid. Ask the desktop to show a new QR code.',
      isExpiredOrUsed: true,
      canRetry: false,
    };
  }

  if (status === 429 || msg.includes('too many') || msg.includes('rate limit')) {
    return {
      title: 'Too Many Attempts',
      message: 'Too many requests were made in a short time. Please wait a moment before trying again.',
      isExpiredOrUsed: false,
      canRetry: true,
    };
  }

  if (status === 500) {
    return {
      title: 'Server Error',
      message: 'Unable to establish video relay. Please verify server connection or generate a new QR code on desktop.',
      isExpiredOrUsed: false,
      canRetry: true,
    };
  }

  // 2. Hardware / permission errors
  if (
    msg.includes('notallowederror') ||
    msg.includes('permission denied') ||
    msg.includes('denied')
  ) {
    return {
      title: 'Camera & Mic Access Denied',
      message: 'Please allow camera and microphone access in your browser settings, then tap Reconnect.',
      isExpiredOrUsed: false,
      canRetry: true,
    };
  }

  if (
    msg.includes('notfounderror') ||
    msg.includes('devicesnotfound') ||
    msg.includes('no device')
  ) {
    return {
      title: 'No Camera or Mic Found',
      message: 'No suitable camera or microphone was detected on this mobile device.',
      isExpiredOrUsed: false,
      canRetry: false,
    };
  }

  if (
    msg.includes('notreadableerror') ||
    msg.includes('trackstarterror') ||
    msg.includes('already in use')
  ) {
    return {
      title: 'Hardware Already in Use',
      message: 'Your camera or microphone is being used by another application. Please close other apps and try again.',
      isExpiredOrUsed: false,
      canRetry: true,
    };
  }

  if (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection refused')
  ) {
    return {
      title: 'Connection Error',
      message: 'Network connection failed. Please ensure your phone is connected to Wi-Fi or mobile data.',
      isExpiredOrUsed: false,
      canRetry: true,
    };
  }

  return {
    title: 'Unexpected Error',
    message: rawMessage || 'An unexpected error occurred while setting up the phone companion.',
    isExpiredOrUsed: false,
    canRetry: true,
  };
}
