export interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
  };

  return (
    <div className="flex items-center gap-2">
      <img
        src="/logo.webp"
        alt="Ottodot Logo"
        className={sizeClasses[size]}
      />
      {showText && (
        <span className="font-heading text-2xl font-bold text-ottodot-blue">
          OTTODOT
        </span>
      )}
    </div>
  );
}
