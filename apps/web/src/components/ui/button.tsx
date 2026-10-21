import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button-default",
      cut: "ui-button-cut",
      outline: "ui-button-outline",
      secondary: "ui-button-secondary",
      ghost: "ui-button-ghost",
      destructive: "ui-button-destructive",
    },
    size: {
      default: "ui-button-md",
      sm: "ui-button-sm",
      lg: "ui-button-lg",
      icon: "ui-button-icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <button ref={ref} data-slot="button" data-size={size} data-variant={variant} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>;

const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <a ref={ref} data-slot="button" data-size={size} data-variant={variant} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
ButtonLink.displayName = "ButtonLink";

export { Button, ButtonLink };
