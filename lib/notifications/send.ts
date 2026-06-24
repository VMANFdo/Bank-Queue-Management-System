import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { TEMPLATES, type NotificationEventType, type TemplatePayload } from "./templates";

export interface SendNotificationParams {
  phone: string;
  eventType: NotificationEventType;
  payload: TemplatePayload;
  ticketId?: string;
  appointmentId?: string;
  language?: "en" | "si" | "ta";
}

export async function sendNotification({
  phone,
  eventType,
  payload,
  ticketId,
  appointmentId,
  language = "en",
}: SendNotificationParams) {
  try {
    const templateFn = TEMPLATES[language][eventType];
    if (!templateFn) {
      console.warn(`Template not found for language ${language} and event ${eventType}`);
      return null;
    }

    const messageBody = templateFn(payload);

    const [notification] = await db
      .insert(notifications)
      .values({
        ticketId: ticketId || null,
        appointmentId: appointmentId || null,
        phone,
        channel: "sms",
        eventType,
        messageBody,
        status: "logged",
      })
      .returning();

    // Log to console for local visibility during dev
    console.log(`[SMS Notification Mock] Sent to ${phone} (${language}): ${messageBody}`);

    return notification;
  } catch (error) {
    console.error("Failed to insert mock notification to DB:", error);
    return null;
  }
}
export { type NotificationEventType };
