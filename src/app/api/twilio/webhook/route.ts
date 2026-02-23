import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import prisma from "@/lib/prisma";

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

// Twilio webhook validation (optional but recommended for production)
function validateTwilioRequest(req: NextRequest, body: string): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        console.warn("TWILIO_AUTH_TOKEN not set, skipping request validation");
        return true; // Skip validation if no auth token (for development)
    }

    const twilioSignature = req.headers.get("x-twilio-signature");
    if (!twilioSignature) {
        console.warn("No Twilio signature found in request");
        return false;
    }

    // Get the full URL for validation
    const url = req.url;

    // Parse the body as form data
    const params: Record<string, string> = {};
    const formData = new URLSearchParams(body);
    formData.forEach((value, key) => {
        params[key] = value;
    });

    return twilio.validateRequest(authToken, twilioSignature, url, params);
}

export async function POST(req: NextRequest) {
    try {
        // Get the raw body for validation
        const body = await req.text();

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
        const conversationPhone = normalizedFrom; // Use the sender's number as conversation identifier

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

        // Return TwiML response (empty response - no auto-reply)
        // You can customize this to send an auto-reply if needed
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
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
