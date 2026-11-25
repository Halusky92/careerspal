type BrandMarkProps = {
  size?: number;
  className?: string;
};

export default function BrandMark({ size = 32, className = "" }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`.trim()}
    />
  );
}
