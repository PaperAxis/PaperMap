import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password field with a show/hide toggle inside the field, aligned right.
// All other props go to the <input>.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Şifreyi gizle' : 'Şifreyi göster';
  return (
    <div className={`password-field ${className}`.trim()}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? (
          <EyeOff size={20} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Eye size={20} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
