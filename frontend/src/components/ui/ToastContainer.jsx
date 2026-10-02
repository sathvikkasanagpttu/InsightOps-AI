import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

/**
 * ToastContainer - Floating Notification Alerts
 */
export default function ToastContainer({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="enterprise-toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const type = toast.type || "info"; // "success" | "error" | "warning" | "info"

        return (
          <div key={toast.id} className={`enterprise-toast toast-${type}`} role="alert">
            <span className="toast-icon">
              {type === "success" && <CheckCircle2 size={16} />}
              {type === "error" && <AlertCircle size={16} />}
              {type === "warning" && <AlertTriangle size={16} />}
              {type === "info" && <Info size={16} />}
            </span>
            <div className="toast-content">
              {toast.title && <strong className="toast-title">{toast.title}</strong>}
              <p className="toast-message">{toast.message}</p>
            </div>
            {onDismiss && (
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            )}
            <div className="toast-progress-bar" />
          </div>
        );
      })}
    </div>
  );
}
