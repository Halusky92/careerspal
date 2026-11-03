export type PublicPerson = {
  id: string;
  name: string;
  image: string;
  headline: string;
  bio: string;
  hobbies: string;
  token: string;
};

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
