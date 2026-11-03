import { personInitials } from "../lib/publicPerson";

type Props = {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE = {
  sm: "h-11 w-11 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-lg",
};

export default function PersonAvatar({ name, image, size = "sm" }: Props) {
  return (
    <div
      className={`${SIZE[size]} shrink-0 overflow-hidden rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold border border-indigo-100`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        personInitials(name)
      )}
    </div>
  );
}
