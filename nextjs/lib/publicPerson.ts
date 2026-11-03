export type PublicPerson = {
  id: string;
  name: string;
  image: string;
  headline: string;
  bio: string;
  hobbies: string;
  token: string;
};

export function personInitials(name?: string) {
  const source = (name || "S").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function hobbyChips(hobbies?: string) {
  return (hobbies || "")
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function toPublicPerson(row: {
  id?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  hobbies?: string | null;
  profile_share_token?: string | null;
}): PublicPerson {
  return {
    id: row.id || "",
    name: row.full_name || "Seeker",
    image: row.avatar_url || "",
    headline: row.headline || "",
    bio: row.bio || "",
    hobbies: row.hobbies || "",
    token: row.profile_share_token || "",
  };
}
