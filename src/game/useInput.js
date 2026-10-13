import { useCallback, useEffect, useRef } from "react";

export default function useInput(paused) {
  const input = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });
  const setControl = useCallback(
    (key, active) => {
      if (key in input.current) input.current[key] = active && !paused;
    },
    [paused],
  );
  useEffect(() => {
    const bindings = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "backward",
      ArrowDown: "backward",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      Space: "brake",
    };
    const clear = () => {
      for (const key of Object.keys(input.current)) input.current[key] = false;
    };
    const change = (e) => {
      if (
        paused ||
        e.target.closest("input,select,textarea,[contenteditable]") ||
        (e.code === "Space" &&
          e.target.closest('button,a[href],[role="button"]'))
      )
        return;
      const key = bindings[e.code];
      if (!key) return;
      e.preventDefault();
      input.current[key] = e.type === "keydown" && !paused;
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", change);
    window.addEventListener("keyup", change);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    clear();
    return () => {
      clear();
      window.removeEventListener("keydown", change);
      window.removeEventListener("keyup", change);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused]);
  return { input, setControl };
}
