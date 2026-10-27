import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <p className="kicker">Missing</p>
      <h1>That page is not on the bench</h1>
      <p className="lede">The address does not match a bench in ATOZ.</p>
      <Link className="btn primary" href="/">
        Back to ATOZ
      </Link>
    </div>
  );
}
