/**
 * Authentication Service for Google OAuth2
 * Handles OAuth2 flow, session management, and user authentication
 */

import { createLogger } from './logger';
import type { DatabaseService } from './database-service';

const log = createLogger('AuthService');

export interface User {
  id: number;
  google_id: string;
  email?: string;
  name: string;
  picture?: string;
  is_admin: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id?: number;
  user_id: number;
  nickname?: string;
  weight?: number;
  cycling_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

export interface AuthConfig {
  google_client_id: string;
  google_client_secret: string;
  redirect_uri: string;
  jwt_secret: string;
}

export class AuthService {
  private db: D1Database;
  private config: AuthConfig;
  private dbService: DatabaseService;

  constructor(db: D1Database, config: AuthConfig, dbService: DatabaseService) {
    this.db = db;
    this.config = config;
    this.dbService = dbService;
  }

  /**
   * Generate OAuth2 authorization URL for Google
   */
  getGoogleAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.google_client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.google_client_id,
        client_secret: this.config.google_client_secret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }

  /**
   * Get user information from Google using access token
   */
  async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }

    return await userResponse.json();
  }

  /**
   * Find or create user in database
   * Delegates to DatabaseService for all database operations
   */
  async findOrCreateUser(googleUser: GoogleUserInfo): Promise<User> {
    try {
      return await this.dbService.findOrCreateUser(googleUser);
    } catch (error) {
      log.error('Error finding or creating user:', error);
      throw error;
    }
  }

  /**
   * Create a new session for user
   */
  async createSession(userId: number): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await this.db
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(sessionId, userId, expiresAt.toISOString())
        .run();

      log.info(`Session created for user ${userId}`);
      return sessionId;
    } catch (error) {
      log.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate session and return user
   */
  async validateSession(sessionId: string): Promise<User | null> {
    try {
      if (!sessionId) return null;

      const session = await this.db
        .prepare(`
          SELECT s.*, u.* FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ?
        `)
        .bind(sessionId, new Date().toISOString())
        .first<Session & User>();

      if (!session) {
        return null;
      }

      // Return user object (strip session fields)
      return {
        id: session.user_id,
        google_id: session.google_id,
        email: session.email,
        name: session.name,
        picture: session.picture,
        is_admin: session.is_admin,
        last_login: session.last_login,
        created_at: session.created_at,
        updated_at: session.updated_at
      };
    } catch (error) {
      log.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Delete session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run();

      log.info(`Session ${sessionId} deleted`);
    } catch (error) {
      log.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.db
        .prepare('DELETE FROM sessions WHERE expires_at < ?')
        .bind(new Date().toISOString())
        .run();

      if (result.meta.changes && result.meta.changes > 0) {
        log.info(`Cleaned up ${result.meta.changes} expired sessions`);
      }
    } catch (error) {
      log.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: number): Promise<boolean> {
    try {
      const user = await this.db
        .prepare('SELECT is_admin FROM users WHERE id = ?')
        .bind(userId)
        .first<{ is_admin: boolean }>();

      return user?.is_admin || false;
    } catch (error) {
      log.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Extract session ID from cookie header
   */
  extractSessionFromCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session_id') {
        return value;
      }
    }
    return null;
  }

  /**
   * Create session cookie
   */
  createSessionCookie(sessionId: string): string {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days

    return `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`;
  }

  /**
   * Create logout cookie (expires session)
   */
  createLogoutCookie(): string {
    return 'session_id=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}