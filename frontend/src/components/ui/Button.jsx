import { cx } from "./severity.js";

export default function Button({ variant = "secondary", size = "md", loading = false, className, disabled, children, ...rest }) {
  return (
    <button type="button" {...rest}
            className={cx("nd-btn", `nd-btn-${variant}`, size === "sm" && "nd-btn-sm", className)}
            disabled={disabled || loading}>
      {loading && <span className="nd-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
