/**
 * Email tracking utilities
 */

/**
 * Add tracking pixel to email HTML
 */
export function addTrackingPixel(emailHtml: string, emailLogId: string, baseUrl: string): string {
  const trackingPixel = `<img src="${baseUrl}/api/emails/track/open/${emailLogId}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;" />`;
  
  // Try to insert before closing body tag
  if (emailHtml.includes('</body>')) {
    return emailHtml.replace('</body>', `${trackingPixel}</body>`);
  }
  
  // Otherwise append to end
  return emailHtml + trackingPixel;
}

/**
 * Wrap links in email with click tracking
 */
export function wrapLinksWithTracking(emailHtml: string, emailLogId: string, baseUrl: string): string {
  // Match all <a> tags with href attributes
  const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi;
  
  return emailHtml.replace(linkRegex, (match, attributes, originalUrl) => {
    // Skip if already a tracking link or unsubscribe link
    if (originalUrl.includes('/api/emails/track/') || originalUrl.includes('/unsubscribe/')) {
      return match;
    }
    
    // Create tracking URL
    const trackingUrl = `${baseUrl}/api/emails/track/click/${emailLogId}?url=${encodeURIComponent(originalUrl)}`;
    
    // Replace href with tracking URL
    const newAttributes = attributes.replace(
      /href=["'][^"']+["']/i,
      `href="${trackingUrl}"`
    );
    
    return `<a ${newAttributes}>`;
  });
}

/**
 * Add full email tracking (pixel + link wrapping)
 */
export function addEmailTracking(emailHtml: string, emailLogId: string, baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'): string {
  let trackedHtml = emailHtml;
  
  // Wrap links first
  trackedHtml = wrapLinksWithTracking(trackedHtml, emailLogId, baseUrl);
  
  // Add tracking pixel
  trackedHtml = addTrackingPixel(trackedHtml, emailLogId, baseUrl);
  
  return trackedHtml;
}

/**
 * Convert plain text email to HTML with tracking
 */
export function textToHtmlWithTracking(text: string, emailLogId: string, baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'): string {
  // Convert newlines to <br>
  let html = text.replace(/\n/g, '<br>');
  
  // Convert URLs to links
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  html = html.replace(urlRegex, (url) => {
    const trackingUrl = `${baseUrl}/api/emails/track/click/${emailLogId}?url=${encodeURIComponent(url)}`;
    return `<a href="${trackingUrl}">${url}</a>`;
  });
  
  // Wrap in basic HTML structure
  html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      ${html}
    </body>
    </html>
  `;
  
  // Add tracking pixel
  html = addTrackingPixel(html, emailLogId, baseUrl);
  
  return html;
}
