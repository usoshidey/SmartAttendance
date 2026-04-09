import { useState, useEffect, useRef } from "react";
import api from "../api";

/**
 * Polls a job's status every `intervalMs` milliseconds until done or failed.
 * Returns { job, isPolling, error }
 */
export default function useJobPoller(jobId, intervalMs = 3000) {
  const [job, setJob] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    setError(null);

    const poll = async () => {
      try {
        const data = await api.getJob(jobId);
        setJob(data);

        if (data.status === "done" || data.status === "failed") {
          setIsPolling(false);
          clearInterval(timerRef.current);
        }
      } catch (e) {
        setError(e.message);
        setIsPolling(false);
        clearInterval(timerRef.current);
      }
    };

    poll(); // Immediate first poll
    timerRef.current = setInterval(poll, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [jobId, intervalMs]);

  return { job, isPolling, error };
}
