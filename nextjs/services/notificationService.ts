
import { Job } from '../types';

export interface Subscriber {
  email: string;
  preference:
    | 'All'
    | 'Operations'
    | 'Systems Design'
    | 'Automation'
    | 'Product Management'
    | 'Engineering & AI'
    | 'Marketing & Growth Ops'
    | 'Customer Success Ops'
    | 'Executive & Staff'
    | 'Finance & Admin';
  joinedAt: string;
}

// 1. Uloženie odberateľa do databázy (Supabase)
export const subscribeUser = async (email: string, preference: Subscriber['preference']) => {
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
    return { success: true, message: payload.message || "Welcome to the Elite list." };
  } catch {
    return { success: false, message: "Unable to subscribe right now." };
  }
};

// 2. Simulácia "Blast" emailov pri novom jobe
export const notifySubscribers = (_job: Job) => {
  // Notification sends handled by backend workflows.
};
