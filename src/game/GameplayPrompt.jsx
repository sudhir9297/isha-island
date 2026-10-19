import { useEffect, useRef, useState } from 'react';

function TimedHint({ label, claimHint }) {
  const accepted = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Strict Mode may replay setup; a mounted hint owns its first claim.
    if (accepted.current === null) accepted.current = claimHint(label);
    if (!accepted.current) return;
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [label, claimHint]);
  if (!visible) return null;
  return <p className="gameplay-prompt gameplay-prompt--hint" role="status"><span>{label}</span></p>;
}

export default function GameplayPrompt({ prompt, touch, onAction, claimHint }) {
  if (!prompt) return null;
  const content = <>{prompt.key && !touch && <kbd>{prompt.key}</kbd>}<span>{prompt.label}
    {prompt.detail && <small>{prompt.detail}</small>}</span></>;
  return prompt.action
    ? <button className="gameplay-prompt" onClick={() => onAction(prompt.action)}>{content}</button>
    : <TimedHint key={prompt.label} label={prompt.label} claimHint={claimHint} />;
}
