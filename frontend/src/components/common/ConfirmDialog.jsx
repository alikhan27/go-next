import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Reusable destructive-action confirmation dialog.
 *
 * Usage (uncontrolled — renders its own trigger):
 *   <ConfirmDialog
 *     trigger={<Button variant="ghost"><Trash /></Button>}
 *     title="Remove service?"
 *     description="This cannot be undone."
 *     confirmLabel="Remove"
 *     onConfirm={() => remove(s)}
 *     testidPrefix={`service-${s.id}`}
 *   />
 *
 * Usage (controlled — when you need to open it programmatically):
 *   <ConfirmDialog open={open} onOpenChange={setOpen} ... />
 */
export default function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "destructive", // "destructive" | "default"
  testidPrefix = "confirm",
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async (e) => {
    // Keep the dialog open until the async action resolves so users get feedback.
    e?.preventDefault?.();
    if (!onConfirm) return;
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange?.(false);
    } finally {
      setBusy(false);
    }
  };

  const actionClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
      : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild disabled={disabled}>
          {trigger}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent data-testid={`${testidPrefix}-dialog`}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {variant === "destructive" && (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={busy}
            data-testid={`${testidPrefix}-cancel`}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={actionClass}
            data-testid={`${testidPrefix}-confirm`}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Working...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
