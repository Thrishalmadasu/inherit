"use client";

// Radix Dialog wrapped in the prototype's modal look (backdrop blur, surface
// card, enter animation). Radix supplies focus-trap/escape/ARIA; we style.
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(4,6,12,0.65)] p-6 backdrop-blur-[4px] data-[state=open]:animate-in">
          <Dialog.Content
            className="w-full max-w-[440px] rounded-lg border border-border-hover bg-surface px-[22px] pb-[18px] pt-[22px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)] outline-none"
            onOpenAutoFocus={(e) => {
              // focus the first textarea/input if present
              const el = (e.currentTarget as HTMLElement)?.querySelector?.(
                "textarea, input",
              ) as HTMLElement | null;
              if (el) {
                e.preventDefault();
                el.focus();
              }
            }}
          >
            <div className="mb-3.5">
              <Dialog.Title className="mb-1.5 text-base font-semibold tracking-[-0.005em] text-fg">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="m-0 text-[13px] leading-[1.5] text-fg-2">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
