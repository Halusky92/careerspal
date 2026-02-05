
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

const DB_KEY = 'cp_subscribers_db';

// 1. Uloženie odberateľa do "skrytej databázy"
export const subscribeUser = (email: string, preference: Subscriber['preference']) => {
  const currentDb: Subscriber[] = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  
  // Check if exists
  if (currentDb.find(s => s.email === email)) {
    return { success: false, message: 'Email is already registered.' };
  }

  const newSubscriber: Subscriber = {
    email,
    preference,
    joinedAt: new Date().toISOString()
  };

  currentDb.push(newSubscriber);
  localStorage.setItem(DB_KEY, JSON.stringify(currentDb));
  
  console.log(`[DATABASE] New subscriber added: ${email} [Pref: ${preference}]`);
  console.log(`[DATABASE] Total subscribers: ${currentDb.length}`);
  
  return { success: true, message: 'Welcome to the Elite list.' };
};

// 2. Simulácia "Blast" emailov pri novom jobe
export const notifySubscribers = (job: Job) => {
  const currentDb: Subscriber[] = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  
  console.log('--- STARTING NOTIFICATION SEQUENCE ---');
  console.log(`New Job Posted: ${job.title} (${job.category})`);

  let sentCount = 0;

  currentDb.forEach(sub => {
    // Matching Logic: Posielame ak chce "All" ALEBO ak sa zhoduje kategória
    const isMatch = sub.preference === 'All' || sub.preference === job.category;

    if (isMatch) {
      console.log(`
        [EMAIL SENT] 
        To: ${sub.email}
        Subject: New Elite Role: ${job.title}
        Body: Hey! A new role matches your preference [${sub.preference}].
              Company: ${job.company}
              Salary: ${job.salary}
              Link: careerspal.com/jobs/${job.id}
      `);
      sentCount++;
    }
  });

  console.log(`--- NOTIFICATION COMPLETE. Sent to ${sentCount} subscribers. ---`);
};
