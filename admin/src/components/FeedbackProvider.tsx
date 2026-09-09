import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toUserMessage } from "../utils/message";

type Severity = "success" | "error" | "info" | "warning";

type AlertOpts = { title?: string; severity?: Severity };
type ConfirmOpts = { title?: string; confirmText?: string; cancelText?: string; danger?: boolean };
export type PromptField = {
  name: string;
  label: string;
  helperText?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
};
type PromptOpts = { title: string; message?: string; fields: PromptField[]; confirmText?: string };

type AlertState = { title: string; message: string; severity: Severity };
type ConfirmState = { title: string; message: string; confirmText: string; cancelText: string; danger: boolean };
type PromptState = { title: string; message: string; fields: PromptField[]; confirmText: string; values: Record<string, string> };

type FeedbackApi = {
  alert: (message: string, opts?: AlertOpts) => Promise<void>;
  success: (message: string) => Promise<void>;
  error: (err: unknown, fallback?: string) => Promise<void>;
  confirm: (message: string, opts?: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<Record<string, string> | null>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TITLE: Record<Severity, string> = {
  success: "成功",
  error: "提示",
  info: "提示",
  warning: "请注意",
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptError, setPromptError] = useState("");
  const alertDone = useRef<(v: void) => void>();
  const confirmDone = useRef<(v: boolean) => void>();
  const promptDone = useRef<(v: Record<string, string> | null) => void>();

  const closeAlert = () => {
    setAlertState(null);
    alertDone.current?.();
    alertDone.current = undefined;
  };
  const closeConfirm = (ok: boolean) => {
    setConfirmState(null);
    confirmDone.current?.(ok);
    confirmDone.current = undefined;
  };
  const closePrompt = (values: Record<string, string> | null) => {
    setPromptState(null);
    setPromptError("");
    promptDone.current?.(values);
    promptDone.current = undefined;
  };

  const alert = useCallback((message: string, opts?: AlertOpts) => {
    return new Promise<void>((resolve) => {
      alertDone.current = resolve;
      setAlertState({
        title: opts?.title || TITLE[opts?.severity || "info"],
        message,
        severity: opts?.severity || "info",
      });
    });
  }, []);

  const api = useMemo<FeedbackApi>(
    () => ({
      alert,
      success: (message) => alert(message, { title: "成功", severity: "success" }),
      error: (err, fallback) => alert(toUserMessage(err, fallback), { title: "操作未完成", severity: "error" }),
      confirm: (message, opts) =>
        new Promise<boolean>((resolve) => {
          confirmDone.current = resolve;
          setConfirmState({
            title: opts?.title || "请确认",
            message,
            confirmText: opts?.confirmText || "确定",
            cancelText: opts?.cancelText || "取消",
            danger: !!opts?.danger,
          });
        }),
      prompt: (opts) =>
        new Promise<Record<string, string> | null>((resolve) => {
          promptDone.current = resolve;
          const values: Record<string, string> = {};
          opts.fields.forEach((f) => {
            values[f.name] = f.defaultValue || "";
          });
          setPromptError("");
          setPromptState({
            title: opts.title,
            message: opts.message || "",
            fields: opts.fields,
            confirmText: opts.confirmText || "确定",
            values,
          });
        }),
    }),
    [alert]
  );

  const submitPrompt = () => {
    if (!promptState) return;
    for (const f of promptState.fields) {
      if (f.required && !String(promptState.values[f.name] || "").trim()) {
        setPromptError(`请填写${f.label}`);
        return;
      }
    }
    closePrompt({ ...promptState.values });
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <Dialog
        open={!!alertState}
        onClose={closeAlert}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, m: 2 } }}
      >
        <DialogTitle>{alertState?.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{alertState?.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={closeAlert} autoFocus>
            知道了
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!confirmState}
        onClose={() => closeConfirm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, m: 2 } }}
      >
        <DialogTitle>{confirmState?.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{confirmState?.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => closeConfirm(false)}>
            {confirmState?.cancelText}
          </Button>
          <Button
            variant="contained"
            color={confirmState?.danger ? "error" : "primary"}
            onClick={() => closeConfirm(true)}
            autoFocus
          >
            {confirmState?.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!promptState}
        onClose={() => closePrompt(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, m: 2 } }}
      >
        <DialogTitle>{promptState?.title}</DialogTitle>
        <DialogContent>
          {promptState?.message ? (
            <Typography sx={{ mb: 2, color: "text.secondary" }}>{promptState.message}</Typography>
          ) : null}
          {promptState?.fields.map((f) => (
            <TextField
              key={f.name}
              fullWidth
              sx={{ mb: 1.5, mt: 0.5 }}
              required={f.required}
              type={f.type || "text"}
              label={f.label}
              helperText={f.helperText}
              placeholder={f.placeholder}
              value={promptState.values[f.name] || ""}
              onChange={(e) => setPromptState({ ...promptState, values: { ...promptState.values, [f.name]: e.target.value } })}
            />
          ))}
          {promptError ? (
            <Typography color="error" sx={{ fontSize: 13 }}>
              {promptError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => closePrompt(null)}>
            取消
          </Button>
          <Button variant="contained" onClick={submitPrompt}>
            {promptState?.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback 必须在 FeedbackProvider 内使用");
  return ctx;
}
