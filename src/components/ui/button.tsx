import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shrink-0",
  {
    variants: {
      variant: {
        default: "bg-indigo-900 text-white hover:bg-indigo-800 shadow-xs",
        accent: "bg-amber-600 text-white hover:bg-amber-700 shadow-xs",
        destructive: "bg-red-700 text-white hover:bg-red-800 shadow-xs",
        outline:
          "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-400",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        link: "text-indigo-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] px-5 py-2.5",
        sm: "min-h-[40px] px-3.5 py-2 text-xs",
        lg: "min-h-[48px] px-6 py-3 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
