import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "ghost" | "text";

const BASE =
  "inline-flex items-center gap-[7px] h-9 px-3.5 rounded-md text-[13.5px] font-medium border border-transparent whitespace-nowrap transition-[background,border-color,transform] duration-150 active:translate-y-[0.5px] [&_svg]:size-3.5";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-gradient-to-b from-[#38a8fa] to-[#0d7bd1] border-white/12 shadow-[0_0_0_1px_var(--color-blue-border),0_4px_14px_-3px_var(--color-blue-glow)] hover:from-[#4cb1fb] hover:to-[#1684d8]",
  ghost:
    "text-fg bg-surface border-border hover:border-border-hover hover:bg-surface-3",
  text: "bg-transparent text-fg-2 border-0 px-2 hover:text-fg",
};

type CommonProps = {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
};

// Renders a Next <Link> when `href` is set, otherwise a <button>.
export function Button({
  variant = "ghost",
  className,
  children,
  href,
  ...rest
}: CommonProps &
  (
    | ({ href: string } & Omit<ComponentProps<typeof Link>, "href" | "className">)
    | ({ href?: undefined } & ComponentProps<"button">)
  )) {
  const classes = cn(BASE, VARIANT[variant], className);
  if (href !== undefined) {
    const linkProps = rest as Omit<ComponentProps<typeof Link>, "href" | "className">;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...(rest as ComponentProps<"button">)}>
      {children}
    </button>
  );
}
