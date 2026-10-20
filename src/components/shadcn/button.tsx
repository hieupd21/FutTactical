import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border-[1.5px] font-bold tracking-[0.04em] whitespace-nowrap uppercase transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-foreground bg-foreground text-background",
        ghost: "border-foreground bg-transparent text-foreground",
        hot: "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-fill)]",
        onInk: "border-[color-mix(in_srgb,var(--bg)_50%,transparent)] bg-transparent text-[var(--bg)]",
        onAccent: "border-[var(--on-fill)] bg-[var(--on-fill)] text-[var(--accent)]",
        destructive: "border-destructive bg-destructive text-[var(--on-fill)]",
        link: "border-transparent bg-transparent text-foreground normal-case underline underline-offset-4",
      },
      size: {
        default: "min-h-[46px] px-[18px] py-[9px] text-[17px]",
        sm: "min-h-11 px-3 py-1.5 text-[14px]",
        icon: "size-[46px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
