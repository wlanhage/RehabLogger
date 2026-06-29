"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "./button";

/**
 * Submit button that shows a spinner + disables while the enclosing
 * server-action <form> is pending. Drop-in for any action form.
 */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
