import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

const steps = [
  { number: '01', title: 'Find your next step', text: 'Connect with peer support around the subjects you are studying.' },
  { number: '02', title: 'Learn together', text: 'Make space for questions, practice, and a fresh perspective.' },
  { number: '03', title: 'Grow as a community', text: 'Students can share what they know and apply to tutor others.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-line" /> PEER LEARNING, MADE SIMPLE</span>
        <h1>Learning feels<br />lighter <em>together.</em></h1>
        <p className="hero-lede">A welcoming place for students to find peer tutoring, share knowledge, and make progress—one conversation at a time.</p>
        <div className="hero-actions"><Link className="button" to={user ? '/dashboard' : '/register'}>{user ? 'Go to your dashboard' : 'Join the community'} <span aria-hidden="true">↗</span></Link><a className="text-link" href="#how-it-works">How it works <span aria-hidden="true">↓</span></a></div>
        <p className="hero-note"><span className="note-dot" /> Built for higher education. Powered by peers.</p>
      </div>
      <div className="hero-art" aria-label="Illustration of a student learning with a peer" role="img">
        <div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="book book-back" /><div className="book book-front"><span /><span /><span /></div>
        <div className="art-person person-left"><div className="person-head" /><div className="person-body" /></div><div className="art-person person-right"><div className="person-head" /><div className="person-body" /></div>
        <div className="floating-card card-note"><span className="card-icon">✳</span><span>Study, share,<br />support.</span></div><div className="floating-card card-check"><span>✓</span> Small steps count</div>
        <div className="art-caption">A little help can go a long way.</div>
      </div>
    </section>
    <section className="how-section" id="how-it-works"><div className="section-wrap"><div className="section-heading"><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h2>Peer support, with room to grow.</h2><p>Whether you need a hand or have one to offer, learning is better when it is shared.</p></div>
      <div className="steps-grid">{steps.map((step) => <article className="step-card" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    </div></section>
    <section className="closing-cta section-wrap"><div><span className="eyebrow">START WHERE YOU ARE</span><h2>Your next learning moment starts here.</h2></div><Link className="button button-light" to={user ? '/dashboard' : '/register'}>{user ? 'Open dashboard' : 'Create an account'} <span aria-hidden="true">↗</span></Link></section>
  </>;
}
