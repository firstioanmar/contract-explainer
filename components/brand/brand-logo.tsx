import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  compact?: boolean;
}

export function BrandLogo({ className, markClassName, compact = false }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo-mark.png"
        width={40}
        height={40}
        alt=""
        priority
        className={cn("size-9 shrink-0 object-contain transition-transform group-hover:rotate-3", markClassName)}
      />
      {!compact && (
        <span className="text-[17px] font-extrabold tracking-[-0.04em]">
          Kontrak<span className="text-primary">Jelas</span>
        </span>
      )}
    </span>
  );
}

