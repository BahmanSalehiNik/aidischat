import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { NotAuthorizedError } from '@aichatwar/shared';

export interface JwtPayload {
  id: string;
  email: string;
}

/**
 * Verify JWT token from WebSocket handshake
 * Token can be in query parameter or Authorization header
 */
export function verifyJWT(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, process.env.JWT_DEV!) as JwtPayload;
    return payload;
  } catch (error) {
    throw new NotAuthorizedError(['Invalid or expired token']);
  }
}

/**
 * Extract JWT from WebSocket handshake
 * Checks both query params and headers
 */
export function extractJWTFromHandshake(url: string, headers: { [key: string]: string | string[] | undefined }): string | null {
  // Try query parameter first (e.g., ws://localhost:3000?token=xxx)
  const urlObj = new URL(url, 'http://localhost');
  const tokenFromQuery = urlObj.searchParams.get('token');
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  // Try Authorization header
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader) {
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (headerValue.startsWith('Bearer ')) {
      return headerValue.substring(7);
    }
    return headerValue;
  }

  return null;
}
