"use client";

// ==========================================
// DUTY LOG MUTATION HOOK
// Client-side wrapper for server actions
// Provides loading, error, and success states
// ==========================================

import { useState, useCallback } from "react";
import {
  submitDutyLog,
  approveDutyLog,
  overrideDutyLog,
  rejectDutyLog,
  type SubmitDutyLogInput,
  type AdminApproveDutyLogInput,
  type AdminOverrideDutyLogInput,
  type DutyLogResponse,
} from "@/actions/dutyLog";
import type { DutyLog } from "@prisma/client";

// ------------------------------------------
// Hook State & Types
// ------------------------------------------

export interface UseDutyLogMutationState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  data: DutyLog | null;
}

export interface UseDutyLogMutationActions {
  submit: (input: SubmitDutyLogInput) => Promise<DutyLogResponse>;
  approve: (input: AdminApproveDutyLogInput) => Promise<DutyLogResponse>;
  override: (input: AdminOverrideDutyLogInput) => Promise<DutyLogResponse>;
  reject: (dutyLogId: string, reason: string) => Promise<DutyLogResponse>;
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
    async (action: () => Promise<DutyLogResponse>): Promise<DutyLogResponse> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null, success: false }));
      try {
        const response = await action();
        if (response.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            success: true,
            data: response.data || null,
            error: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: response.error || "Unknown error",
            success: false,
          }));
        }
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          success: false,
        }));
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const submit = useCallback(
    (input: SubmitDutyLogInput) => executeAction(() => submitDutyLog(input)),
    [executeAction]
  );

  const approve = useCallback(
    (input: AdminApproveDutyLogInput) => executeAction(() => approveDutyLog(input)),
    [executeAction]
  );

  const override = useCallback(
    (input: AdminOverrideDutyLogInput) => executeAction(() => overrideDutyLog(input)),
    [executeAction]
  );

  const reject = useCallback(
    (dutyLogId: string, reason: string) => executeAction(() => rejectDutyLog(dutyLogId, reason)),
    [executeAction]
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      success: false,
      data: null,
    });
  }, []);

  return {
    ...state,
    submit,
    approve,
    override,
    reject,
    reset,
  };
}
