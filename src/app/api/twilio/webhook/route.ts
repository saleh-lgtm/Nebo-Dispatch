import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import prisma from "@/lib/prisma";

/**
 * Escape XML special characters to prevent TwiML injection attacks.
 * This is CRITICAL for security when embedding user content in TwiML responses.
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// Normalize phone number to E.164 format for consistent conversation threading
function normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }
    if (phone.startsWith("+")) {
        return phone;
    }
    return `+1${digits}`;
}

// Twilio webhook validation - ENFORCED for security
// SECURITY: Validation can ONLY be skipped in development mode with explicit flag
function validateTwilioRequest(req: NextRequest, body: string): { valid: boolean; error?: string } {
    // SECURITY FIX: Both conditions must be true to skip validation
    // This prevents accidental deployment with validation disabled
    const isDevelopment = process.env.NODE_ENV === "development";
    const skipFlagSet = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true";

    if (isDevelopment && skipFlagSet) {
        console.warn("⚠️ Twilio signature validation SKIPPED - development mode only!");
        return { valid: true };
    }

    // In production, ALWAYS validate - even if skip flag is accidentally set
    if (!isDevelopment && skipFlagSet) {
        console.error("🚨 SECURITY: TWILIO_SKIP_SIGNATURE_VALIDATION ignored in production!");
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        console.error("TWILIO_AUTH_TOKEN not set - webhook validation will fail");
        return { valid: false, error: "Server configuration error" };
    }

    const twilioSignature = req.headers.get("x-twilio-signature");
    if (!twilioSignature) {
        console.warn("No Twilio signature found in request - possible spoofing attempt");
        return { valid: false, error: "Missing signature" };
    }

    // Get the webhook URL (use TWILIO_WEBHOOK_URL for proxy/tunnel scenarios)
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL || req.url;

    // Parse the body as form data
    const params: Record<string, string> = {};
    const formData = new URLSearchParams(body);
    formData.forEach((value, key) => {
        params[key] = value;
    });

    const isValid = twilio.validateRequest(authToken, twilioSignature, webhookUrl, params);
    if (!isValid) {
        console.warn("Invalid Twilio signature - request rejected");
        return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
}

// Opt-out keywords that carriers require handling
const OPT_OUT_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const HELP_KEYWORDS = ["HELP", "INFO"];

export async function POST(req: NextRequest) {
    try {
        // Get the raw body for validation
        const body = await req.text();

        console.warn("[Webhook] Received inbound SMS request");

        // Validate the request is from Twilio
        const validation = validateTwilioRequest(req, body);
        if (!validation.valid) {
            console.error("[Webhook] Validation failed:", validation.error, {
                hasSignature: !!req.headers.get("x-twilio-signature"),
                webhookUrl: process.env.TWILIO_WEBHOOK_URL || "not set",
            });
            return new NextResponse("Forbidden", { status: 403 });
        }

        console.warn("[Webhook] Validation passed, processing message");

        // Parse the form data
        const formData = new URLSearchParams(body);

        // Extract Twilio webhook fields
        const from = formData.get("From") || "";
        const to = formData.get("To") || "";
        const messageBody = formData.get("Body") || "";
        const messageSid = formData.get("MessageSid") || "";
        const numSegments = formData.get("NumSegments") || "1";

        // Validate the incoming message has required fields
        if (!from || !messageBody) {
            console.error("Missing required fields in Twilio webhook:", { from, messageBody });
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Normalize phone numbers for conversation threading
        const normalizedFrom = normalizePhoneNumber(from);
        const conversationPhone = normalizedFrom;

        // Check for opt-out/help keywords
        const upperMessage = messageBody.trim().toUpperCase();
        let autoReply = "";

        if (OPT_OUT_KEYWORDS.includes(upperMessage)) {
            // Mark user as opted out in database
            await prisma.sMSOptOut.upsert({
                where: { phoneNumber: normalizedFrom },
                create: {
                    phoneNumber: normalizedFrom,
                    optedOutAt: new Date(),
                },
                update: {
                    optedOutAt: new Date(),
                    optedInAt: null,
                },
            });
            autoReply = "You have been unsubscribed and will not receive further messages. Reply START to resubscribe.";
            console.log(`User ${from} opted out of SMS`);
        } else if (upperMessage === "START") {
            // Opt user back in
            await prisma.sMSOptOut.upsert({
                where: { phoneNumber: normalizedFrom },
                create: {
                    phoneNumber: normalizedFrom,
                    optedInAt: new Date(),
                },
                update: {
                    optedInAt: new Date(),
                },
            });
            autoReply = "You have been resubscribed to messages from Nebo Rides. Reply STOP to unsubscribe.";
            console.log(`User ${from} opted back in to SMS`);
        } else if (HELP_KEYWORDS.includes(upperMessage)) {
            autoReply = "Nebo Rides SMS Support. Reply STOP to unsubscribe. For help, call us or visit our website.";
        }

        // Store the incoming SMS in the database
        await prisma.sMSLog.create({
            data: {
                direction: "INBOUND",
                from: from,
                to: to,
                message: messageBody,
                status: "received",
                messageSid: messageSid,
                segments: parseInt(numSegments) || 1,
                conversationPhone: conversationPhone,
            },
        });

        console.log(`Received SMS from ${from}: ${messageBody.substring(0, 50)}...`);

        // Return TwiML response with optional auto-reply
        // SECURITY: Always escape auto-reply content to prevent TwiML injection
        const twimlResponse = autoReply
            ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapeXml(autoReply)}</Message>
</Response>`
            : `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

        return new NextResponse(twimlResponse, {
            status: 200,
            headers: {
                "Content-Type": "text/xml",
            },
        });
    } catch (error) {
        console.error("Error processing Twilio webhook:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

// Handle GET requests (for Twilio webhook verification)
export async function GET() {
    return new NextResponse("Twilio webhook endpoint is active", { status: 200 });
}
