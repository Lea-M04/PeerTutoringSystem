import { Link } from 'react-router';

export default function NotFoundPage() {
  return <section className="not-found section-wrap"><span className="eyebrow">PAGE NOT FOUND</span><h1>Looks like this<br />page took a <em>detour.</em></h1><p>The link may have moved. Let’s get you back on track.</p><Link className="button" to="/">Return home <span aria-hidden="true">↗</span></Link></section>;
}
