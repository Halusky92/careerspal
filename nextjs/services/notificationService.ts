
import { Job } from '../types';

export interface Subscriber {
  email: string;
  preference: string;
  joinedAt: string;
}

export const subscribeUser = async (email: string, preference: string) => {
  try {
    const response = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, preference }),
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      return { success: false, message: payload.error || "Unable to subscribe right now." };
    }
    return { success: true, message: payload.message || "Subscription confirmed." };
  } catch {
    return { success: false, message: "Unable to subscribe right now." };
  }
};

// 2. Simulácia "Blast" emailov pri novom jobe
export const notifySubscribers = (_job: Job) => {
  // Notification sends handled by backend workflows.
};
