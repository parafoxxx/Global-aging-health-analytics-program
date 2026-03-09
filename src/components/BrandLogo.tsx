type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "h-66 w-66", alt = "GAHASP logo" }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} className={className} />;
}

