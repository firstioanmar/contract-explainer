import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98] [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/.55)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_12px_28px_-8px_hsl(var(--primary)/.65)]",
        outline: "border border-border bg-background/80 text-foreground shadow-sm hover:border-primary/30 hover:bg-primary/[.04]",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        soft: "bg-primary/[.08] text-primary hover:bg-primary/[.13]",
        danger: "bg-destructive/[.08] text-destructive hover:bg-destructive/[.13]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
