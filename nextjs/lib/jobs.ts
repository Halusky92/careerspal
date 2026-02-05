import { MOCK_COMPANIES, MOCK_JOBS } from '../constants';
import { Company, Job } from '../types';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const createJobSlug = (job: Job) => `${slugify(job.title)}--${job.id}`;

export const getJobIdFromSlug = (slug: string) => {
  const parts = slug.split('--');
  return parts.length > 1 ? parts[parts.length - 1] : slug;
};

export const getAllJobs = () => MOCK_JOBS;

export const getJobById = (id: string) =>
  MOCK_JOBS.find((job) => job.id === id) || null;

export const getJobBySlug = (slug: string) => getJobById(getJobIdFromSlug(slug));

export const createCompanySlug = (company: Pick<Company, 'name'>) =>
  `${slugify(company.name)}`;

export const getAllCompanies = () => Object.values(MOCK_COMPANIES);

export const getCompanyBySlug = (slug: string) => {
  const company = Object.values(MOCK_COMPANIES).find(
    (item) => createCompanySlug(item) === slug,
  );
  return company || null;
};
