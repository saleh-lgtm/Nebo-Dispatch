import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import prisma from "@/lib/prisma";

// Twilio webhook validation for status callbacks
function validateTwilioRequest(req: NextRequest, body: string): { valid: boolean; error?: string } {
    if (process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true") {
        return { valid: true };
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        return { valid: false, error: "Server configuration error" };
    }

    const twilioSignature = req.headers.get("x-twilio-signature");
    if (!twilioSignature) {
        return { valid: false, error: "Missing signature" };
    }

    const webhookUrl = process.env.TWILIO_STATUS_CALLBACK_URL || req.url;

    const params: Record<string, string> = {};
    const formData = new URLSearchParams(body);
    formData.forEach((value, key) => {
        params[key] = value;
    });

    const isValid = twilio.validateRequest(authToken, twilioSignature, webhookUrl, params);
    return isValid ? { valid: true } : { valid: false, error: "Invalid signature" };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();

        // Validate the request is from Twilio
        const validation = validateTwilioRequest(req, body);
        if (!validation.valid) {
            console.error("Status webhook validation failed:", validation.error);
            return new NextResponse("Forbidden", { status: 403 });
        }

        const formData = new URLSearchParams(body);

        // Extract status callback fields
        const messageSid = formData.get("MessageSid") || "";
        const messageStatus = formData.get("MessageStatus") || "";
        const errorCode = formData.get("ErrorCode");
        const errorMessage = formData.get("ErrorMessage");

        if (!messageSid || !messageStatus) {
            console.error("Missing required fields in status webhook:", { messageSid, messageStatus });
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Update the message status in the database
        const updated = await prisma.sMSLog.updateMany({
            where: { messageSid },
            data: {
                status: messageStatus,
                ...(errorCode && { error: `${errorCode}: ${errorMessage || "Unknown error"}` }),
            },
        });

        if (updated.count > 0) {
            console.log(`SMS ${messageSid} status updated to: ${messageStatus}`);
        } else {
            console.warn(`SMS ${messageSid} not found in database for status update`);
        }

        // Return empty 200 response
        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error("Error processing status webhook:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

// Health check endpoint
export async function GET() {
    return new NextResponse("Twilio status webhook endpoint is active", { status: 200 });
}
