import { createLogger } from './logger'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { google } from 'googleapis'

const log = createLogger('EmailService')

export type EmailProvider = 'mailchannels' | 'resend' | 'gmail'

export interface EmailConfig {
  from_email: string
  from_name: string
  app_url: string
  provider?: EmailProvider
  resend_api_key?: string
  // Gmail OAuth 2.0 configuration (uses existing Google OAuth credentials)
  google_client_id?: string
  google_client_secret?: string
  google_refresh_token?: string  // Optional: for service accounts
  gmail_user?: string           // Gmail address to send from
}

export interface InvitationEmailData {
  to_email: string
  to_name: string
  inviter_name: string
  invitation_token: string
  invitation_message?: string
  role: string
}

/**
 * Base interface for email providers
 */
interface EmailProviderInterface {
  sendEmail(to: { email: string; name?: string }, subject: string, html: string, text: string): Promise<boolean>
}

/**
 * MailChannels provider implementation
 * MailChannels is free for Cloudflare Workers
 */
class MailChannelsProvider implements EmailProviderInterface {
  constructor(private fromEmail: string, private fromName: string) {}

  async sendEmail(
    to: { email: string; name?: string },
    subject: string,
    html: string,
    text: string
  ): Promise<boolean> {
    try {
      const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [
                {
                  email: to.email,
                  name: to.name || to.email,
                },
              ],
            },
          ],
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject: subject,
          content: [
            {
              type: 'text/plain',
              value: text,
            },
            {
              type: 'text/html',
              value: html,
            },
          ],
        }),
      })

      if (response.ok) {
        log.info(`✅ Email sent successfully via MailChannels to ${to.email}`)
        return true
      } else {
        const errorText = await response.text()
        log.error(`❌ MailChannels failed: ${response.status} ${errorText}`)
        return false
      }
    } catch (error) {
      log.error('MailChannels error:', error)
      return false
    }
  }
}

/**
 * Gmail provider implementation using nodemailer with OAuth 2.0
 * Uses existing Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
 */
class GmailProvider implements EmailProviderInterface {
  private transporter: Transporter
  private oauth2Client: any

  constructor(
    private fromEmail: string,
    private fromName: string,
    clientId: string,
    clientSecret: string,
    gmailUser: string,
    refreshToken?: string
  ) {
    // Create OAuth2 client using existing Google credentials
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground' // Redirect URI for refresh tokens
    )
    log.info('OAuth2 client created for Gmail')
    // If refresh token is provided, set it
    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      })
    }

    // Create nodemailer transporter with OAuth2
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId: clientId,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
        accessToken: undefined // Will be generated automatically
      },
      // Additional options for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    } as any)

    log.info(`Gmail provider initialized for ${gmailUser} with OAuth 2.0`)
  }

  async sendEmail(
    to: { email: string; name?: string },
    subject: string,
    html: string,
    text: string
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: to.name ? `"${to.name}" <${to.email}>` : to.email,
        subject: subject,
        text: text,
        html: html,
      }

      const info = await this.transporter.sendMail(mailOptions)
      log.info(`✅ Email sent successfully via Gmail to ${to.email} (Message ID: ${info.messageId})`)
      return true
    } catch (error) {
      log.error('Gmail error:', error)
      return false
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      log.info('✅ Gmail SMTP connection verified successfully')
      return true
    } catch (error) {
      log.error('❌ Gmail SMTP connection verification failed:', error)
      return false
    }
  }

  /**
   * Close the transporter
   */
  close(): void {
    this.transporter.close()
    log.info('Gmail transporter closed')
  }
}

/**
 * Resend provider implementation
 * Resend is a modern email API for developers
 */
class ResendProvider implements EmailProviderInterface {
  constructor(
    private apiKey: string,
    private fromEmail: string,
    private fromName: string
  ) {}

  async sendEmail(
    to: { email: string; name?: string },
    subject: string,
    html: string,
    text: string
  ): Promise<boolean> {
    
   try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [to.email],
          subject: subject,
          html: html,
          text: text,
        }),
      })
   
      if (response.status === 200 || response.status === 202) {
        const result = await response.json()
        log.info(`✅ Email sent successfully via Resend to ${to.email} (ID: ${JSON.stringify(result)})`)
        return true
      } else {                
        const errorData = await response.json()        
        const errorObj = typeof errorData === 'object' && errorData !== null ? errorData as { error?: { message?: string } } : {};
        log.info(`❌ Resend failed: ${JSON.stringify(errorObj)}`)
        return false
      }
    } catch (error) {
      log.error('Resend error:', error)
      return false
    }
  }
}

/**
 * EmailService handles sending emails using multiple providers
 * Supports MailChannels (free for Cloudflare Workers) and Resend
 */
export class EmailService {
  private config: EmailConfig
  private provider: EmailProviderInterface

  constructor(config: EmailConfig) {
    this.config = config
    
    // Determine which provider to use
    const providerType = config.provider || 'gmail' // Default to Gmail if not specified
    
    if (providerType === 'gmail') {
      // Gmail provider with OAuth 2.0
      if (!config.gmail_user || !config.google_client_id || !config.google_client_secret) {
        log.error('Gmail OAuth credentials not provided, falling back to MailChannels')
        this.provider = new MailChannelsProvider(config.from_email, config.from_name)
      } else {
        log.info('Using Gmail email provider via OAuth 2.0')
        this.provider = new GmailProvider(
          config.from_email,
          config.from_name,
          config.google_client_id,
          config.google_client_secret,
          config.gmail_user,
          config.google_refresh_token
        )
        // Verify connection on initialization
        /*
        ;(this.provider as GmailProvider).verifyConnection().catch(err => {
          log.error('Failed to verify Gmail OAuth connection:', err)
        })
        */
      }
    }else if (!config.resend_api_key) {
      log.warn('Resend API key not provided, falling back to MailChannels')
      this.provider = new MailChannelsProvider(config.from_email, config.from_name)
    } else {
      log.info('Using Resend email provider')
      this.provider = new ResendProvider(
        config.resend_api_key,
        config.from_email,
        config.from_name
      )
    }
  }

  /**
   * Send an invitation email to a new user
   */
  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    log.info(`Sending invitation email to ${JSON.stringify(data)}`)

    const invitationUrl = `${this.config.app_url}accept-invitation?token=${data.invitation_token}`
    const subject = `You've been invited to join Cycling Calories Calculator`
    const htmlContent = this.generateInvitationEmailHTML(data, invitationUrl)
    const textContent = this.generateInvitationEmailText(data, invitationUrl)

    return await this.provider.sendEmail(
      { email: data.to_email, name: data.to_name },
      subject,
      htmlContent,
      textContent
    )
  }

  /**
   * Generate HTML content for invitation email
   */
  private generateInvitationEmailHTML(data: InvitationEmailData, invitationUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to Cycling Calories Calculator</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        h1 {
            color: #570df8;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .content {
            margin-bottom: 30px;
        }
        .message-box {
            background-color: #f0f4ff;
            border-left: 4px solid #570df8;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .cta-button {
            display: inline-block;
            background-color: #570df8;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #4506cb;
        }
        .role-badge {
            display: inline-block;
            background-color: #e0e7ff;
            color: #570df8;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
        .link {
            color: #570df8;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="header-icon">🚴</div>
            <h1>You're Invited!</h1>
        </div>
        
        <div class="content">
            <p>Hello ${data.to_name || 'there'},</p>
            
            <p><strong>${data.inviter_name}</strong> has invited you to join <strong>Cycling Calories Calculator</strong>, a powerful platform for tracking and analyzing your cycling activities.</p>
            
            <p>You've been invited as: <span class="role-badge">${data.role === 'admin' ? 'Administrator' : 'User'}</span></p>
            
            ${data.invitation_message ? `
            <div class="message-box">
                <strong>Personal message from ${data.inviter_name}:</strong>
                <p style="margin: 10px 0 0 0;">${data.invitation_message}</p>
            </div>
            ` : ''}
            
            <p>Click the button below to accept your invitation and create your account:</p>
            
            <div style="text-align: center;">
                <a href="${invitationUrl}" class="cta-button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px;"><a href="${invitationUrl}" class="link">${invitationUrl}</a></p>
            
            <p style="margin-top: 30px;"><strong>What you can do:</strong></p>
            <ul>
                <li>📤 Upload and analyze GPX files from your cycling activities</li>
                <li>🔥 Track calories burned with accurate calculations</li>
                <li>📊 View detailed statistics and performance trends</li>
                <li>🌤️ Get weather-based cycling recommendations</li>
                <li>📈 Monitor your progress over time</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <p style="margin-top: 20px;">
                <small>&copy; 2025 Cycling Calories Calculator. All rights reserved.</small>
            </p>
        </div>
    </div>
</body>
</html>
    `
  }

  /**
   * Generate plain text content for invitation email
   */
  private generateInvitationEmailText(data: InvitationEmailData, invitationUrl: string): string {
    let text = `You're Invited to Cycling Calories Calculator!\n\n`
    text += `Hello ${data.to_name || 'there'},\n\n`
    text += `${data.inviter_name} has invited you to join Cycling Calories Calculator, a powerful platform for tracking and analyzing your cycling activities.\n\n`
    text += `You've been invited as: ${data.role === 'admin' ? 'Administrator' : 'User'}\n\n`

    if (data.invitation_message) {
      text += `Personal message from ${data.inviter_name}:\n`
      text += `"${data.invitation_message}"\n\n`
    }

    text += `Accept your invitation by clicking this link:\n`
    text += `${invitationUrl}\n\n`
    text += `What you can do:\n`
    text += `- Upload and analyze GPX files from your cycling activities\n`
    text += `- Track calories burned with accurate calculations\n`
    text += `- View detailed statistics and performance trends\n`
    text += `- Get weather-based cycling recommendations\n`
    text += `- Monitor your progress over time\n\n`
    text += `This invitation will expire in 7 days.\n\n`
    text += `If you didn't expect this invitation, you can safely ignore this email.\n\n`
    text += `© 2025 Cycling Calories Calculator. All rights reserved.`

    return text
  }

  /**
   * Send a test email to verify configuration
   */
  async sendTestEmail(to_email: string): Promise<boolean> {
    log.info(`Sending test email to ${to_email}`)

    const subject = 'Test Email from Cycling Calories Calculator'
    const text = 'This is a test email from Cycling Calories Calculator. If you received this, the email service is working correctly!'
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #570df8;">📧 Test Email</h2>
        <p>${text}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e5e5;">
        <p style="font-size: 12px; color: #666;">
          &copy; 2025 Cycling Calories Calculator. All rights reserved.
        </p>
      </div>
    `

    return await this.provider.sendEmail(
      { email: to_email },
      subject,
      html,
      text
    )
  }
}
