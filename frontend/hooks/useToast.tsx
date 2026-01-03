import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, message, type };
    
    setToasts((prev) => [...prev, toast]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = useCallback(() => {
    if (toasts.length === 0) return null;

    return (
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-top-2 ${
              toast.type === "success"
                ? "bg-green-500/10 border-green-500 text-green-500"
                : toast.type === "error"
                ? "bg-red-500/10 border-red-500 text-red-500"
                : "bg-yellow-500/10 border-yellow-500 text-yellow-500"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="size-5 flex-shrink-0" />}
            {toast.type === "error" && <XCircle className="size-5 flex-shrink-0" />}
            {toast.type === "warning" && <AlertCircle className="size-5 flex-shrink-0" />}
            <p className="text-sm font-medium text-foreground">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-foreground/60 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    );
  }, [toasts, removeToast]);

  return { showToast, ToastContainer };
}
