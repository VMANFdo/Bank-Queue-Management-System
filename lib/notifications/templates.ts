export type NotificationEventType =
  | "ticket_issued"
  | "appointment_confirmed"
  | "tickets_away"
  | "called"
  | "window_opening"
  | "expired"
  | "delay_alert"
  | "linked_pair_update"
  | "reroute_update"
  | "priority_interleave_notice";

export interface TemplatePayload {
  tokenNumber?: string;
  branchName?: string;
  serviceName?: string;
  counterName?: string;
  waitEstimate?: string | number;
  position?: string | number;
  bookingCode?: string;
  windowStart?: string;
  windowEnd?: string;
  revisedWindowStart?: string;
  revisedWindowEnd?: string;
  ticketsAway?: string | number;
}

export type LocalizedTemplates = Record<NotificationEventType, (payload: TemplatePayload) => string>;

export const TEMPLATES: Record<"en" | "si" | "ta", LocalizedTemplates> = {
  en: {
    ticket_issued: (p) =>
      `Your ticket ${p.tokenNumber} for ${p.serviceName} has been issued at ${p.branchName}. Estimated wait time: ${p.waitEstimate} mins. Position: ${p.position}.`,
    appointment_confirmed: (p) =>
      `Appointment confirmed for ${p.serviceName} at ${p.branchName}. Booking code: ${p.bookingCode}. Window: ${p.windowStart} - ${p.windowEnd}.`,
    tickets_away: (p) =>
      `You are ${p.ticketsAway} tickets away for ticket ${p.tokenNumber} at ${p.branchName}. Please head to the waiting area.`,
    called: (p) =>
      `Ticket ${p.tokenNumber} called to ${p.counterName} at ${p.branchName} for ${p.serviceName}.`,
    window_opening: (p) =>
      `Your appointment window is starting soon: ${p.windowStart} - ${p.windowEnd} at ${p.branchName}. Code: ${p.bookingCode}.`,
    expired: (p) =>
      `Your appointment booking ${p.bookingCode} for ${p.serviceName} at ${p.branchName} has expired as you did not check in.`,
    delay_alert: (p) =>
      `Notice: Due to queue delays, your appointment window at ${p.branchName} has been updated to: ${p.revisedWindowStart} - ${p.revisedWindowEnd}. We apologize for the inconvenience.`,
    linked_pair_update: (p) =>
      `Your linked ticket ${p.tokenNumber} has been updated. Next service: ${p.serviceName}.`,
    reroute_update: (p) =>
      `Your ticket ${p.tokenNumber} has been rerouted to ${p.counterName} due to counter adjustments. New wait: ${p.waitEstimate} mins.`,
    priority_interleave_notice: (p) =>
      `A priority customer has been interleaved ahead of ticket ${p.tokenNumber}. Your current position is ${p.position}. Thank you for your patience.`,
  },
  si: {
    ticket_issued: (p) =>
      `ඔබගේ ටිකට් අංකය ${p.tokenNumber} (${p.serviceName}) ${p.branchName} හිදී නිකුත් කර ඇත. ඇස්තමේන්තුගත කාලය: මිනිත්තු ${p.waitEstimate}. පෝලිමේ ස්ථානය: ${p.position}.`,
    appointment_confirmed: (p) =>
      `හමුවීම තහවුරු කරන ලදී (${p.serviceName} - ${p.branchName}). වෙන්කිරීම් කේතය: ${p.bookingCode}. වේලාව: ${p.windowStart} - ${p.windowEnd}.`,
    tickets_away: (p) =>
      `${p.branchName} හි ඔබගේ ටිකට්පත් අංක ${p.tokenNumber} සඳහා තව ටිකට්පත් ${p.ticketsAway} ක් ඉතිරිව ඇත. කරුණාකර රැඳී සිටින ස්ථානයට පැමිණෙන්න.`,
    called: (p) =>
      `ටිකට් අංකය ${p.tokenNumber} ${p.branchName} හි ${p.counterName} වෙත කැඳවා ඇත. සේවාව: ${p.serviceName}.`,
    window_opening: (p) =>
      `ඔබගේ හමුවීමේ වේලාව ළඟදීම ආරම්භ වේ: ${p.windowStart} - ${p.windowEnd} (${p.branchName}). කේතය: ${p.bookingCode}.`,
    expired: (p) =>
      `${p.branchName} හි ${p.serviceName} සඳහා වූ ඔබගේ හමුවීම ${p.bookingCode} ඔබ පැමිණීම තහවුරු නොකිරීම නිසා කල් ඉකුත් වී ඇත.`,
    delay_alert: (p) =>
      `දැනුම්දීමයි: පෝලිම් ප්‍රමාදයන් හේතුවෙන්, ඔබගේ හමුවීමේ වේලාව ${p.branchName} හිදී වෙනස් කර ඇත: ${p.revisedWindowStart} - ${p.revisedWindowEnd}. සිදු වූ අපහසුතාවයට කණගාටු වෙමු.`,
    linked_pair_update: (p) =>
      `ඔබගේ සම්බන්ධිත ටිකට්පත ${p.tokenNumber} යාවත්කාලීන කර ඇත. ඊළඟ සේවාව: ${p.serviceName}.`,
    reroute_update: (p) =>
      `කවුන්ටර වෙනස්කම් හේතුවෙන් ඔබගේ ටිකට්පත ${p.tokenNumber} ${p.counterName} වෙත යොමු කර ඇත. නව ඇස්තමේන්තුගත කාලය: මිනිත්තු ${p.waitEstimate}.`,
    priority_interleave_notice: (p) =>
      `ප්‍රමුඛතා පාරිභෝගිකයෙකු ඔබගේ ටිකට්පත් ${p.tokenNumber} ට පෙර ඇතුළත් කර ඇත. ඔබගේ වත්මන් ස්ථානය ${p.position} වේ. ඉවසීම ගැන ස්තුතියි.`,
  },
  ta: {
    ticket_issued: (p) =>
      `${p.branchName} இல் ${p.serviceName} க்கான உங்கள் டிக்கெட் ${p.tokenNumber} வழங்கப்பட்டுள்ளது. மதிப்பிடப்பட்ட காத்திருப்பு நேரம்: ${p.waitEstimate} நிமிடங்கள். வரிசை நிலை: ${p.position}.`,
    appointment_confirmed: (p) =>
      `${p.branchName} இல் ${p.serviceName} க்கான முன்பதிவு உறுதிசெய்யப்பட்டது. முன்பதிவு குறியீடு: ${p.bookingCode}. நேரம்: ${p.windowStart} - ${p.windowEnd}.`,
    tickets_away: (p) =>
      `டிக்கெட் ${p.tokenNumber} க்கு இன்னும் ${p.ticketsAway} டிக்கெட்டுகள் மட்டுமே உள்ளன. தயவுசெய்து காத்திருப்பு பகுதிக்கு செல்லவும்.`,
    called: (p) =>
      `${p.branchName} இல் டிக்கெட் ${p.tokenNumber} கவுண்டர் ${p.counterName} க்கு அழைக்கப்பட்டுள்ளது. சேவை: ${p.serviceName}.`,
    window_opening: (p) =>
      `உங்கள் முன்பதிவு நேரம் விரைவில் தொடங்குகிறது: ${p.windowStart} - ${p.windowEnd} (${p.branchName}). குறியீடு: ${p.bookingCode}.`,
    expired: (p) =>
      `டிக்கெட் பெறப்படாததால், ${p.branchName} இல் ${p.serviceName} க்கான உங்கள் முன்பதிவு ${p.bookingCode} காலாவதியானது.`,
    delay_alert: (p) =>
      `அறிவிப்பு: வரிசை தாமதங்கள் காரணமாக, உங்களுக்கான முன்பதிவு நேரம் ${p.branchName} இல் மாற்றப்பட்டுள்ளது: ${p.revisedWindowStart} - ${p.revisedWindowEnd}. அசௌகரியத்திற்கு வருந்துகிறோம்.`,
    linked_pair_update: (p) =>
      `உங்களுடன் இணைக்கப்பட்ட டிக்கெட் ${p.tokenNumber} புதுப்பிக்கப்பட்டது. அடுத்த சேவை: ${p.serviceName}.`,
    reroute_update: (p) =>
      `கவுண்டர் மாற்றங்கள் காரணமாக உங்கள் டிக்கெட் ${p.tokenNumber} கவுண்டர் ${p.counterName} க்கு மாற்றப்பட்டுள்ளது. புதிய காத்திருப்பு நேரம்: ${p.waitEstimate} நிமிடங்கள்.`,
    priority_interleave_notice: (p) =>
      `டிக்கெட் ${p.tokenNumber} க்கு முன்னதாக முன்னுரிமை வாடிக்கையாளர் ஒருவர் வரிசையில் சேர்க்கப்பட்டுள்ளார். உங்கள் தற்போதைய வரிசை நிலை ${p.position}. காத்திருப்புக்கு நன்றி.`,
  },
};
