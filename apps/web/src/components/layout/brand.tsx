import Link from 'next/link';

interface BrandProps {
  className?: string;
}

export function Brand({ className = '' }: BrandProps) {
  return (
    <Link className={`brand ${className}`.trim()} href="/" aria-label="Synchub home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" role="img">
          <path className="brand-link-line" d="M10 11.5 18 18m8-6.5L18 18m0 0v8" />
          <circle className="brand-node brand-node-left" cx="9.5" cy="11" r="3.2" />
          <circle className="brand-node brand-node-right" cx="26.5" cy="11" r="3.2" />
          <circle className="brand-node brand-node-center" cx="18" cy="18" r="3.8" />
          <circle className="brand-node brand-node-bottom" cx="18" cy="27" r="2.8" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>synchub</strong>
        <small>delivery network</small>
      </span>
    </Link>
  );
}
