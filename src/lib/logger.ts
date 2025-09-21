/**
 * Logger utility for Cloudflare Workers with Hono
 * Provides structured logging that works well with Cloudflare's logging system
 */

export interface Logger {
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  debug: (message: string, ...args: any[]) => void
}

class WorkerLogger implements Logger {
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const argsStr = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : ''
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${argsStr}`
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('info', message, ...args))
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message, ...args))
  }

  error(message: string, arg: any): void {
    console.error(this.formatMessage('error', message, arg.name, arg.message))
  }

  debug(message: string, ...args: any[]): void {
    console.log(this.formatMessage('debug', message, ...args))
  }
}

// Export singleton logger instance
export const logger: Logger = new WorkerLogger()

// Export factory function for context-aware logging
export const createLogger = (context?: string): Logger => {
  return {
    info: (message: string, ...args: any[]) => 
      logger.info(context ? `[${context}] ${message}` : message, ...args),
    warn: (message: string, ...args: any[]) => 
      logger.warn(context ? `[${context}] ${message}` : message, ...args),
    error: (message: string, arg: any) => 
      logger.error(context ? `[${context}] ${message}` : message, arg),
    debug: (message: string, ...args: any[]) => 
      logger.debug(context ? `[${context}] ${message}` : message, ...args)
  }
}