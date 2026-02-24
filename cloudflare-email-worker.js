/**
 * Cloudflare Email Worker - Manifest Ingestion
 *
 * This worker receives emails sent to your Cloudflare email routing address
 * and forwards the content to your app's manifest ingestion API.
 *
 * Setup Instructions:
 * 1. Create a Worker in Cloudflare Dashboard > Workers & Pages > Create Application
 * 2. Paste this code into the worker
 * 3. Add these secrets in Worker Settings > Variables & Secrets:
 *    - MANIFEST_SECRET: The same secret configured in your app's MANIFEST_INGEST_SECRET
 *    - INGEST_URL: Your app's ingestion endpoint (e.g., https://your-app.com/api/manifests/ingest)
 *
 * 4. Set up Email Routing (Cloudflare Dashboard > Email > Email Routing):
 *    - Add your domain's MX records if not already configured
 *    - Create a custom address (e.g., manifests@yourdomain.com)
 *    - Route to this Worker
 *
 * 5. Configure allowed senders in the ALLOWED_SENDERS array below
 */

// Configure allowed sender email addresses or domains
const ALLOWED_SENDERS = [
  // Add exact email addresses
  // "manifests@partnercompany.com",
  // "dispatch@affiliate.com",

  // Or use domains (any email from this domain will be allowed)
  // "@partnercompany.com",
  // "@affiliate.com",
];

// If empty, all senders are allowed (not recommended for production)
const ALLOW_ALL_SENDERS = ALLOWED_SENDERS.length === 0;

export default {
  async email(message, env, ctx) {
    // Extract email metadata
    const from = message.from;
    const subject = message.headers.get("subject") || "";

    // Check if sender is allowed
    if (!ALLOW_ALL_SENDERS) {
      const isAllowed = ALLOWED_SENDERS.some(allowed => {
        if (allowed.startsWith("@")) {
          // Domain check
          return from.toLowerCase().endsWith(allowed.toLowerCase());
        }
        // Exact email check
        return from.toLowerCase() === allowed.toLowerCase();
      });

      if (!isAllowed) {
        console.log(`Rejected email from unauthorized sender: ${from}`);
        // Silently accept but don't process (prevents bounce revealing info)
        return;
      }
    }

    // Read the email body
    let body = "";
    try {
      // Get the raw email content
      const rawEmail = await new Response(message.raw).text();

      // Try to extract plain text body from the email
      body = extractPlainTextBody(rawEmail);

      if (!body) {
        console.error("Could not extract email body");
        return;
      }
    } catch (error) {
      console.error("Error reading email body:", error);
      return;
    }

    // Forward to your app's API
    try {
      const response = await fetch(env.INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Manifest-Secret": env.MANIFEST_SECRET,
          "X-Forwarded-For": "cloudflare-email-worker",
        },
        body: JSON.stringify({
          from: from,
          subject: subject,
          body: body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error: ${response.status} - ${errorText}`);
      } else {
        const result = await response.json();
        console.log(`Manifest processed: ${result.created || 0} trips created, ${result.duplicate || 0} duplicates`);
      }
    } catch (error) {
      console.error("Error forwarding to API:", error);
    }
  },
};

/**
 * Extract plain text body from raw email
 * Handles both simple plain text emails and multipart MIME messages
 */
function extractPlainTextBody(rawEmail) {
  // Check for multipart content
  const contentTypeMatch = rawEmail.match(/Content-Type:\s*([^\r\n;]+)/i);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : "";

  if (contentType.includes("multipart")) {
    // Extract boundary
    const boundaryMatch = rawEmail.match(/boundary="?([^"\r\n]+)"?/i);
    if (!boundaryMatch) {
      return extractSimpleBody(rawEmail);
    }

    const boundary = boundaryMatch[1];
    const parts = rawEmail.split(`--${boundary}`);

    // Find plain text part
    for (const part of parts) {
      if (part.includes("Content-Type: text/plain") || part.includes("content-type: text/plain")) {
        // Extract body after headers (double newline)
        const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (bodyMatch) {
          return decodeBody(bodyMatch[1], part);
        }
      }
    }

    // Fallback: try HTML part and strip tags
    for (const part of parts) {
      if (part.includes("Content-Type: text/html") || part.includes("content-type: text/html")) {
        const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (bodyMatch) {
          return stripHtml(decodeBody(bodyMatch[1], part));
        }
      }
    }
  }

  // Simple single-part email
  return extractSimpleBody(rawEmail);
}

/**
 * Extract body from simple (non-multipart) email
 */
function extractSimpleBody(rawEmail) {
  // Find body after headers (double CRLF or LF)
  const parts = rawEmail.split(/\r?\n\r?\n/);
  if (parts.length > 1) {
    // Skip the headers (first part)
    return parts.slice(1).join("\n\n").trim();
  }
  return rawEmail;
}

/**
 * Decode body based on Content-Transfer-Encoding
 */
function decodeBody(body, partHeaders) {
  // Check for encoding
  const encodingMatch = partHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : "";

  if (encoding === "base64") {
    try {
      return atob(body.replace(/\s/g, ""));
    } catch (e) {
      return body;
    }
  }

  if (encoding === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }

  return body.trim();
}

/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip HTML tags (basic)
 */
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .trim();
}
