/** Extract only the new reply content, removing quoted/forwarded text */
export function extractReplyContent(replyBody: string): string {
  if (!replyBody) return '';

  const lines = replyBody.split('\n');
  const replyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (
      trimmedLine.match(/^On .+? wrote:?\s*$/i) ||
      trimmedLine.match(/^On .+?<.+?>\s*wrote:?\s*$/i) ||
      trimmedLine.match(/^\d{4}-\d{2}-\d{2}.+? wrote:?\s*$/i) ||
      trimmedLine.startsWith('>') ||
      trimmedLine.match(/^-{3,}\s*(Original|Forwarded)\s*Message\s*-{3,}/i) ||
      trimmedLine.match(/^-{3,}\s*Original Message\s*-{3,}/i) ||
      (trimmedLine.match(/^(From|Sent|To|Subject|Date):\s*.+/i) && i > 0) ||
      (i > 0 && lines[i - 1].trim() === '' && trimmedLine.match(/^On .+/i))
    ) {
      break;
    }

    replyLines.push(line);
  }

  let cleanedBody = replyLines.join('\n').trim();
  cleanedBody = cleanedBody.replace(/\n\s*\n\s*$/g, '');

  if (cleanedBody.length < 2) {
    const firstPara = replyBody.split('\n\n')[0];
    return firstPara.substring(0, 500).trim();
  }

  return cleanedBody;
}
