import { Company, Job } from '../types';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const createJobSlug = (job: Pick<Job, 'title' | 'id'>) =>
  `${slugify(job.title)}--${job.id}`;

export const getJobIdFromSlug = (slug: string) => {
  const parts = slug.split('--');
  return parts.length > 1 ? parts[parts.length - 1] : slug;
};

export const createCompanySlug = (company: Pick<Company, 'name'>) =>
  `${slugify(company.name)}`;
