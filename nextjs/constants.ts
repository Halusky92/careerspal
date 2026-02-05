
import { Job, Company, Candidate, SalaryStat } from './types';

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Head of Operations (Notion-first)',
    company: 'FlowState Systems',
    logo: 'https://picsum.photos/seed/flow/100/100',
    location: 'Remote (Global)',
    type: 'Full-time',
    salary: '$120k - $160k',
    postedAt: 'Just Now',
    category: 'Operations',
    description: 'We are looking for an Ops leader to scale our internal Notion workspace and automate core business processes. You should be an expert in database architecture and team workflows.',
    companyDescription: 'FlowState is a premier consultancy for high-growth startups building on Notion and Airtable.',
    tags: ['Notion', 'Systems Architecture', 'Zapier', 'Process Design'],
    tools: ['Notion', 'Zapier', 'Slack'],
    isFeatured: true,
    planType: 'Elite Managed',
    remotePolicy: 'Global Remote',
    applyUrl: '#',
    benefits: ['Notion Certification Budget', 'Remote Work Stipend', 'Performance Bonuses'],
    matchScore: 98
  },
  {
    id: '2',
    title: 'Systems Architect (Make/Zapier)',
    company: 'Automately',
    logo: 'https://picsum.photos/seed/auto/100/100',
    location: 'Remote (Europe/US)',
    type: 'Contract',
    salary: '$80/hr - $120/hr',
    postedAt: '4 hours ago',
    category: 'Engineering & AI',
    description: 'Join us to build complex multi-step automations connecting Notion, Slack, and CRM systems for enterprise clients.',
    companyDescription: 'Automately is the leading automation agency for Notion-based companies.',
    tags: ['Make.com', 'Zapier', 'API', 'Notion'],
    tools: ['Make.com', 'Zapier', 'Notion'],
    planType: 'Featured Pro',
    isFeatured: true,
    remotePolicy: 'Remote (Global)',
    applyUrl: '#',
    benefits: ['Flexible Hours', 'Project Bonuses'],
    matchScore: 85
  },
  {
    id: '3',
    title: 'Operations Manager (Notion Expert)',
    company: 'ScaleUp Labs',
    logo: 'https://picsum.photos/seed/scale/100/100',
    location: 'Remote (USA)',
    type: 'Full-time',
    salary: '$90k - $115k',
    postedAt: '1 day ago',
    category: 'Operations',
    description: 'Help us maintain our Notion OS. You will be responsible for documentation, project tracking, and optimizing our internal operating system.',
    companyDescription: 'A venture studio building 4 companies per year, all running on Notion.',
    tags: ['Notion', 'Project Management', 'Ops', 'Airtable'],
    tools: ['Notion', 'Airtable', 'Slack'],
    planType: 'Standard',
    remotePolicy: 'USA Remote',
    applyUrl: '#',
    benefits: ['Unlimited PTO', 'Annual Retreat'],
    matchScore: 72
  }
];

export const MOCK_COMPANIES: Record<string, Company> = {
  'FlowState Systems': {
    name: 'FlowState Systems',
    logo: 'https://picsum.photos/seed/flow/100/100',
    website: 'https://flowstate.example.com',
    description: 'Premier consultancy for high-growth startups.',
    longDescription: 'FlowState Systems is where chaos meets structure. We are a team of elite Notion Architects and Operations experts dedicated to building the operating systems of the future. We believe that tools like Notion and Airtable are not just software, but the canvas for modern work. Our culture is deep work, asynchronous first, and radically transparent.',
    foundedYear: '2021',
    employeeCount: '11-50',
    headquarters: 'San Francisco (Fully Remote)',
    images: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'
    ],
    techStack: ['Notion', 'Airtable', 'Slack', 'Linear', 'Super.so'],
    remoteDNA: {
      asyncLevel: 'Async-First',
      meetingsPerWeek: 'Low (<5h)',
      cameraPolicy: 'Optional',
      retreats: 'Quarterly',
      communicationStyle: 'Text-heavy',
      onboarding: 'Structured Bootcamp'
    },
    socialLinks: { linkedin: '#', twitter: '#' }
  },
  'Automately': {
    name: 'Automately',
    logo: 'https://picsum.photos/seed/auto/100/100',
    website: 'https://automately.example.com',
    description: 'The leading automation agency.',
    longDescription: 'We connect the dots. Automately helps enterprise clients save thousands of hours by connecting disparate tools into a unified ecosystem using Make.com and Zapier. We are engineering-heavy, logic-obsessed, and love complex API challenges.',
    foundedYear: '2023',
    employeeCount: '1-10',
    headquarters: 'London, UK',
    images: [
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80'
    ],
    techStack: ['Make.com', 'Zapier', 'Python', 'Rest API', 'Postman'],
    remoteDNA: {
      asyncLevel: 'Deep Work',
      meetingsPerWeek: 'Low (<3h)',
      cameraPolicy: 'Off',
      retreats: 'Annual',
      communicationStyle: 'Text-heavy',
      onboarding: 'Self-paced'
    },
    socialLinks: { linkedin: '#' }
  },
  'ScaleUp Labs': {
    name: 'ScaleUp Labs',
    logo: 'https://picsum.photos/seed/scale/100/100',
    website: 'https://scaleup.example.com',
    description: 'Venture studio building 4 companies/year.',
    longDescription: 'ScaleUp Labs isn’t just a company; it’s a factory for startups. We build, launch, and scale 4 SaaS products every year. Our Ops team is the backbone that makes this speed possible. If you love fast-paced environments and wearing multiple hats, this is home.',
    foundedYear: '2020',
    employeeCount: '51-200',
    headquarters: 'New York, USA',
    images: [
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80'
    ],
    techStack: ['Notion', 'ClickUp', 'Figma', 'Webflow'],
    remoteDNA: {
      asyncLevel: 'Hybrid',
      meetingsPerWeek: 'High (10h+)',
      cameraPolicy: 'Always On',
      retreats: 'Annual',
      communicationStyle: 'Video-heavy',
      onboarding: 'Shadowing'
    },
    socialLinks: { linkedin: '#', twitter: '#' }
  }
};

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    title: 'Senior Notion Architect',
    level: 'Architect',
    location: 'London, UK',
    rate: '$120/hr',
    skills: ['Notion Certified', 'Formula Expert', 'System Design', 'Python'],
    bio: 'I build operating systems for scaling agencies. Specialized in complex relational databases and automated dashboards.',
    availability: '2 weeks',
    verified: true,
    featured: true,
    exCompanies: ['Ex-Revolut', 'Notion Ambassador']
  },
  {
    id: 'c2',
    title: 'Automation Engineer (Make/Zapier)',
    level: 'Senior',
    location: 'Berlin, DE',
    rate: '$95/hr',
    skills: ['Make.com', 'Zapier', 'Webhooks', 'Airtable Scripting'],
    bio: 'Connecting tools so you do not have to copy-paste data ever again. I have saved clients 500+ hours monthly.',
    availability: 'Immediate',
    verified: true,
    featured: false,
    exCompanies: ['Ex-Klarna']
  },
  {
    id: 'c3',
    title: 'Head of Remote Ops',
    level: 'Lead',
    location: 'Austin, TX',
    rate: '$150k/yr',
    skills: ['Async Work', 'Documentation', 'Slack Ops', 'ClickUp'],
    bio: 'Operational leader focused on async-first culture and transparent documentation. Building remote teams from 0 to 50.',
    availability: '1 month',
    verified: true,
    featured: true,
    exCompanies: ['Ex-GitLab']
  },
  {
    id: 'c4',
    title: 'Product Operations Manager',
    level: 'Mid',
    location: 'Toronto, CA',
    rate: '$90k/yr',
    skills: ['Linear', 'Notion', 'Product Analytics', 'User Research'],
    bio: 'Bridging the gap between product and engineering with streamlined workflows in Linear and Notion.',
    availability: 'Immediate',
    verified: false,
    featured: false
  }
];

export const CATEGORIES = [
  'All Roles',
  'Operations',
  'Systems Design',
  'Automation',
  'Product Management',
  'Engineering & AI',
  'Marketing & Growth Ops',
  'Customer Success Ops',
  'Executive & Staff',
  'Finance & Admin'
];

export const MOCK_SALARIES: SalaryStat[] = [
  {
    role: 'Notion Architect',
    category: 'Systems Design',
    min: 75000,
    median: 115000,
    max: 160000,
    hourlyMin: 60,
    hourlyMax: 150,
    demand: 'Very High',
    trend: 'Up'
  },
  {
    role: 'Operations Manager',
    category: 'Operations',
    min: 65000,
    median: 95000,
    max: 135000,
    hourlyMin: 45,
    hourlyMax: 90,
    demand: 'High',
    trend: 'Stable'
  },
  {
    role: 'Automation Engineer',
    category: 'Automation',
    min: 90000,
    median: 125000,
    max: 180000,
    hourlyMin: 80,
    hourlyMax: 180,
    demand: 'Very High',
    trend: 'Up'
  },
  {
    role: 'Head of Remote',
    category: 'Executive & Staff',
    min: 110000,
    median: 150000,
    max: 220000,
    hourlyMin: 100,
    hourlyMax: 250,
    demand: 'Medium',
    trend: 'Stable'
  },
  {
    role: 'Product Ops',
    category: 'Product Management',
    min: 80000,
    median: 110000,
    max: 145000,
    hourlyMin: 55,
    hourlyMax: 110,
    demand: 'High',
    trend: 'Up'
  }
];
