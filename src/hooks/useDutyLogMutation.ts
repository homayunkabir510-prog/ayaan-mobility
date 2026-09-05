"use client";

// ==========================================
// DUTY LOG MUTATION HOOK
// Client-side wrapper for the Server Actions in src/lib/actions/duty-log.ts
// Provides loading, error, and success states.
// ==========================================

import { useState, useCallback } from "react";
import {
  endDutyAction,
  adminOverrideDutyLogAction,
  approveDutyLogAction,
  rejectDutyLogAction,
  type EndDutyInput,
  type AdminOverrideInput,
  type DutyCalculationResult,
} from "@/lib/actions/duty-log";
import type { ActionResult } from "@/lib/actions/shared";

// ------------------------------------------
// Hook State & Types
// ------------------------------------------

export interface UseDutyLogMutationState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  data: DutyCalculationResult | null;
}

export interface UseDutyLogMutationActions {
  submit: (input: EndDutyInput) => Promise<ActionResult<DutyCalculationResult>>;
  override: (input: AdminOverrideInput) => Promise<ActionResult<DutyCalculationResult>>;
  approve: (dutyLogId: string) => Promise<ActionResult<null>>;
  reject: (dutyLogId: string, reason: string) => Promise<ActionResult<null>>;
  reset: () => void;
}

// ------------------------------------------
// Hook Implementation
// ------------------------------------------

export function useDutyLogMutation(): UseDutyLogMutationState & UseDutyLogMutationActions {
  const [state, setState] = useState<UseDutyLogMutationState>({
    isLoading: false,
    error: null,
    success: false,
    data: null,
  });

  const executeAction = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>, onData: (data: T) => void): Promise<ActionResult<T>> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null, success: false }));
      try {
        const response = await action();
        if (response.success) {
          onData(response.data);
          setState((prev) => ({ ...prev, isLoading: false, success: true, error: null }));
        } else {
          setState((prev) => ({ ...prev, isLoading: false, error: response.error, success: false }));
        }
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage, success: false }));
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const submit = useCallback(
    (input: EndDutyInput) =>
      executeAction(() => endDutyAction(input), (data) => setState((prev) => ({ ...prev, data }))),
    [executeAction]
  );

  const override = useCallback(
    (input: AdminOverrideInput) =>
      executeAction(() => adminOverrideDutyLogAction(input), (data) => setState((prev) => ({ ...prev, data }))),
    [executeAction]
  );

  const approve = useCallback(
    (dutyLogId: string) =>
      executeAction(() => approveDutyLogAction(dutyLogId), () => setState((prev) => ({ ...prev, data: null }))),
    [executeAction]
  );

  const reject = useCallback(
    (dutyLogId: string, reason: string) =>
      executeAction(
        () => rejectDutyLogAction(dutyLogId, reason),
        () => setState((prev) => ({ ...prev, data: null }))
      ),
    [executeAction]
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, success: false, data: null });
  }, []);

  return { ...state, submit, override, approve, reject, reset };
}
