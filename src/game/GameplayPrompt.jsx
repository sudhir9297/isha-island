import { useEffect, useState } from 'react';

function TimedHint({ label }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setExpired(true), 4000);
    return () => window.clearTimeout(timeout);
  }, []);
  if (expired) return null;
  return <p className="gameplay-prompt gameplay-prompt--hint" role="status"><span>{label}</span></p>;
}

export default function GameplayPrompt({ prompt, touch, onAction }) {
  if (!prompt) return null;
  const content = <>{prompt.key && !touch && <kbd>{prompt.key}</kbd>}<span>{prompt.label}
    {prompt.detail && <small>{prompt.detail}</small>}</span></>;
  return prompt.action
    ? <button className="gameplay-prompt" onClick={() => onAction(prompt.action)}>{content}</button>
    : <TimedHint key={prompt.label} label={prompt.label} />;
}
