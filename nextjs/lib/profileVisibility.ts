export const PROFILE_VISIBILITY = ["private", "employers", "link"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[number];

export function isProfileVisibility(value: string | null | undefined): value is ProfileVisibility {
  return value === "private" || value === "employers" || value === "link";
}
