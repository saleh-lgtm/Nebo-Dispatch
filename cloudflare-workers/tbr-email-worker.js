export default {
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get('subject') || '';
    
    console.log(`Received email from: ${from}, subject: ${subject}`);
    
    try {
      // Get raw email as ArrayBuffer
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const emailData = await parseEmail(rawEmail);
      
      // Send to n8n webhook
      const response = await fetch('https://neborides.app.n8n.cloud/webhook/tbr-email-ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from,
          to: to,
          subject: subject,
          body: emailData.body,
          html: emailData.html,
          attachments: emailData.attachments,
          receivedAt: new Date().toISOString(),
        }),
      });
      
      console.log(`n8n response: ${response.status}`);
      
      if (!response.ok) {
        // Forward to Gmail as backup
        await message.forward('neborides@gmail.com');
      }
      
    } catch (error) {
      console.error('Error processing email:', error);
      // Forward to Gmail as backup on error
      await message.forward('neborides@gmail.com');
    }
  }
}

async function parseEmail(rawEmail) {
  const decoder = new TextDecoder();
  const emailText = decoder.decode(rawEmail);
  
  let body = '';
  let html = '';
  const attachments = [];
  
  // Find boundary for multipart emails
  const boundaryMatch = emailText.match(/boundary="?([^"\r\n]+)"?/i);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = emailText.split('--' + boundary);
    
    for (const part of parts) {
      // Plain text
      if (part.includes('Content-Type: text/plain')) {
        const textMatch = part.match(/\r\n\r\n([\s\S]*?)(?=\r\n--|$)/);
        if (textMatch) {
          body = decodeContent(textMatch[1], part);
        }
      }
      
      // HTML
      if (part.includes('Content-Type: text/html')) {
        const htmlMatch = part.match(/\r\n\r\n([\s\S]*?)(?=\r\n--|$)/);
        if (htmlMatch) {
          html = decodeContent(htmlMatch[1], part);
        }
      }
      
      // PDF attachment
      if (part.includes('application/pdf') || part.toLowerCase().includes('filename') && part.toLowerCase().includes('.pdf')) {
        const filenameMatch = part.match(/filename="?([^"\r\n]+)"?/i);
        const contentMatch = part.match(/\r\n\r\n([\s\S]*?)(?=\r\n--|$)/);
        
        if (contentMatch) {
          attachments.push({
            filename: filenameMatch ? filenameMatch[1].trim() : 'attachment.pdf',
            contentType: 'application/pdf',
            content: contentMatch[1].replace(/[\r\n\s]/g, ''),
          });
        }
      }
    }
  } else {
    // Simple email
    const bodyMatch = emailText.match(/\r\n\r\n([\s\S]*)/);
    if (bodyMatch) {
      body = bodyMatch[1];
    }
  }
  
  return { body, html, attachments };
}

function decodeContent(content, part) {
  if (part.includes('base64')) {
    try {
      return atob(content.replace(/[\r\n\s]/g, ''));
    } catch {
      return content;
    }
  }
  if (part.includes('quoted-printable')) {
    return content
      .replace(/=\r\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return content;
}
