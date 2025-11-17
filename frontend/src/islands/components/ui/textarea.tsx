import * as React from "react";

import { cn } from "@islands/lib/utils";

const textareaBaseClasses = [
  "flex",
  "min-h-[120px]",
  "w-full",
  "rounded-md",
  "border",
  "border-input",
  "bg-transparent",
  "px-3",
  "py-2",
  "text-base",
  "shadow-sm",
  "transition-colors",
  "placeholder:text-muted-foreground",
].join(" ");

const textareaStateClasses = [
  "focus-visible:outline-none",
  "focus-visible:border-ring",
  "focus-visible:ring-0",
  "disabled:cursor-not-allowed",
  "disabled:opacity-50",
  "md:text-sm",
].join(" ");

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(textareaBaseClasses, textareaStateClasses, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
