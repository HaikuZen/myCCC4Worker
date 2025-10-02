/**
 * Unit tests for email privacy functions
 * Tests email masking and hashing implementations
 */

import { describe, it, expect } from 'vitest';

/**
 * Email masking function (extracted for testing)
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  
  // Mask local part: keep first and last character, mask the rest
  let maskedLocal = localPart;
  if (localPart.length > 2) {
    maskedLocal = localPart[0] + '*'.repeat(Math.min(localPart.length - 2, 3)) + localPart[localPart.length - 1];
  } else if (localPart.length === 2) {
    maskedLocal = localPart[0] + '*';
  } else {
    maskedLocal = '*';
  }

  // Mask domain: keep first character and TLD, mask the rest
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    const domainName = domainParts[0];
    const tld = domainParts.slice(1).join('.');
    
    let maskedDomain = domainName;
    if (domainName.length > 2) {
      maskedDomain = domainName[0] + '*'.repeat(Math.min(domainName.length - 2, 3)) + domainName[domainName.length - 1];
    } else if (domainName.length === 2) {
      maskedDomain = domainName[0] + '*';
    } else {
      maskedDomain = '*';
    }
    
    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  return `${maskedLocal}@${domain}`;
}

/**
 * Email hashing function (extracted for testing)
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('Email Privacy Functions', () => {
  describe('maskEmail', () => {
    it('should mask a standard email address', () => {
      const result = maskEmail('john.doe@example.com');
      expect(result).toBe('j***e@e***e.com');
    });

    it('should mask short email addresses', () => {
      expect(maskEmail('ab@cd.com')).toBe('a*@c*.com');
      expect(maskEmail('a@b.com')).toBe('*@*.com');
    });

    it('should mask long email addresses', () => {
      const result = maskEmail('verylongemailaddress@longdomainname.com');
      // Should limit asterisks to 3
      expect(result).toBe('v***s@l***e.com');
    });

    it('should handle email with subdomain', () => {
      const result = maskEmail('user@mail.example.com');
      expect(result).toBe('u***r@m***l.example.com');
    });

    it('should handle single character local part', () => {
      const result = maskEmail('a@example.com');
      expect(result).toBe('*@e***e.com');
    });

    it('should handle two character local part', () => {
      const result = maskEmail('ab@example.com');
      expect(result).toBe('a*@e***e.com');
    });

    it('should handle two character domain', () => {
      const result = maskEmail('user@ab.com');
      expect(result).toBe('u***r@a*.com');
    });

    it('should handle single character domain', () => {
      const result = maskEmail('user@a.com');
      expect(result).toBe('u***r@*.com');
    });

    it('should return invalid email unchanged', () => {
      expect(maskEmail('notanemail')).toBe('notanemail');
      expect(maskEmail('')).toBe('');
    });

    it('should preserve email pattern for recognition', () => {
      const masked = maskEmail('admin@company.com');
      expect(masked).toMatch(/^[a-z*]+@[a-z*]+\.[a-z]+$/);
      expect(masked).toContain('@');
      expect(masked).toContain('.');
    });
  });

  describe('hashEmail', () => {
    it('should create a consistent hash for the same email', async () => {
      const email = 'test@example.com';
      const hash1 = await hashEmail(email);
      const hash2 = await hashEmail(email);
      
      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different emails', async () => {
      const hash1 = await hashEmail('user1@example.com');
      const hash2 = await hashEmail('user2@example.com');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should create a 64 character hex string', async () => {
      const hash = await hashEmail('test@example.com');
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be case insensitive', async () => {
      const hash1 = await hashEmail('User@Example.Com');
      const hash2 = await hashEmail('user@example.com');
      
      expect(hash1).toBe(hash2);
    });

    it('should trim whitespace', async () => {
      const hash1 = await hashEmail('  user@example.com  ');
      const hash2 = await hashEmail('user@example.com');
      
      expect(hash1).toBe(hash2);
    });

    it('should create a secure one-way hash', async () => {
      const email = 'secret@example.com';
      const hash = await hashEmail(email);
      
      // Hash should not contain the original email
      expect(hash).not.toContain('secret');
      expect(hash).not.toContain('example');
      expect(hash).not.toContain('@');
    });
  });

  describe('Privacy Protection', () => {
    it('should ensure masked email does not reveal full email', () => {
      const original = 'sensitive.information@private-company.com';
      const masked = maskEmail(original);
      
      expect(masked).not.toContain('sensitive');
      expect(masked).not.toContain('information');
      expect(masked).not.toContain('private');
      expect(masked).not.toContain('company');
    });

    it('should maintain enough information for user recognition', () => {
      const masked = maskEmail('john@example.com');
      
      // Should preserve first and last characters
      expect(masked[0]).toBe('j');
      expect(masked.split('@')[0].slice(-1)).toBe('n');
      
      // Should preserve domain TLD
      expect(masked).toContain('.com');
    });

    it('should work with various email formats', () => {
      const testCases = [
        'name@domain.com',
        'first.last@company.co.uk',
        'user+tag@mail.example.org',
        'admin@localhost.local',
        'contact@subdomain.example.com'
      ];

      testCases.forEach(email => {
        const masked = maskEmail(email);
        expect(masked).toContain('@');
        expect(masked).toContain('*');
        expect(masked.length).toBeGreaterThan(0);
      });
    });
  });
});
