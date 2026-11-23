import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, ChevronLeft, ChevronRight, Clock3, Globe2, PackageCheck, Pause, Plane, Play, ShieldCheck, Ship } from 'lucide-react'
import './home-refresh.css'

const slides = [
  {
    eyebrow: 'AEROSWIFT GLOBAL · LOGISTICS, CONNECTED',
    title: 'Global shipping.',
    accent: 'Made clearer.',
    copy: 'Parcel shipping, air freight and cargo coordination—backed by responsive support and a clearer view of your next move.',
    image: '/aeroswift-hero.jpg',
    alt: 'Cargo aircraft and freight handling on an airport apron at dusk',
    action: 'Plan a shipment',
    href: '/shipping',
    link: 'Explore our services',
    linkHref: '/services',
  },
  {
    eyebrow: 'AIR FREIGHT · ROUTE AND CARGO SUPPORT',
    title: 'Time-sensitive cargo.',
    accent: 'Handled with care.',
    copy: 'Talk to our team about your cargo, deadlines and handling requirements. We’ll help you understand the next steps.',
    image: '/aeroswift-warehouse.jpg',
    alt: 'Freight pallets prepared for dispatch in a distribution warehouse',
    action: 'Explore air freight',
    href: '/air-freight',
    link: 'Request a freight quote',
    linkHref: '/contact',
  },
  {
    eyebrow: 'OCEAN FREIGHT · INTERNATIONAL CARGO',
    title: 'Move more.',
    accent: 'Go further.',
    copy: 'Planning a larger consignment? Share your route and requirements and our team can help coordinate your freight enquiry.',
    image: '/aeroswift-ocean.jpg',
    alt: 'Container vessel carrying international freight across open water',
    action: 'Start a freight enquiry',
    href: '/contact',
    link: 'See shipping options',
    linkHref: '/shipping',
  },
]

const services = [
  { number: '01', title: 'Parcel shipping', text: 'Send parcels and business shipments with support for the details that matter.', icon: PackageCheck, image: '/aeroswift-warehouse.jpg', link: '/shipping', label: 'For packages of every size' },
  { number: '02', title: 'Air freight', text: 'Coordinate time-sensitive cargo movements with a team that keeps you informed.', icon: Plane, image: '/aeroswift-hero.jpg', link: '/air-freight', label: 'For urgent cargo' },
  { number: '03', title: 'Ocean freight', text: 'Plan larger consignments and international movements with clear communication.', icon: Ship, image: '/aeroswift-ocean.jpg', link: '/air-freight', label: 'For bigger journeys' },
]

const steps = [
  ['01', 'Tell us what is moving', 'Share the route, shipment details and timing you have in mind.'],
  ['02', 'We coordinate the details', 'Our team can review your requirements and follow up on the next steps.'],
  ['03', 'Stay up to date', 'Use carrier-reported tracking updates where available to follow your shipment.'],
]

function TrackingCard() {
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)

  async function track(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setResult(null)
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: number.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'We could not retrieve this shipment yet.')
      setResult(data.tracker)
    } catch (error) {
      setMessage(error.message || 'Tracking is temporarily unavailable. You can also try the full tracking page.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="home-track-card">
    <div className="home-track-heading"><span className="home-icon"><PackageCheck size={20}/></span><div><span className="home-kicker">SHIPMENT VISIBILITY</span><h2>Track a shipment</h2></div></div>
    <p>Enter a tracking number to check for the latest carrier-reported updates.</p>
    <form onSubmit={track} className="home-track-form">
      <label className="sr-only" htmlFor="home-tracking-number">Tracking number</label>
      <input id="home-tracking-number" value={number} onChange={event => setNumber(event.target.value)} placeholder="e.g. tracking number" minLength={4} required />
      <button className="home-track-submit" type="submit" disabled={busy} aria-label="Track shipment">{busy ? 'Checking…' : <ArrowRight size={19}/>}</button>
    </form>
    {message && <p className="home-track-message" role="alert">{message} <Link to="/track">Open full tracking <ArrowRight size={13}/></Link></p>}
    {result && <div className="home-track-result" role="status"><b>{String(result.status || 'Shipment update').replace(/[_-]/g, ' ')}</b><span>{result.events?.[0]?.description || 'Latest carrier update received.'}</span><Link to="/track">View tracking details <ArrowRight size={13}/></Link></div>}
    <Link className="home-track-all" to="/track">Go to full tracking page <ArrowUpRight size={14}/></Link>
  </div>
}

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [manuallyPaused, setManuallyPaused] = useState(false)
  const reduceMotion = useReducedMotion()
  const slide = slides[activeSlide]

  useEffect(() => {
    if (reduceMotion || hovered || focused || manuallyPaused) return undefined
    const timer = window.setInterval(() => setActiveSlide(current => (current + 1) % slides.length), 6500)
    return () => window.clearInterval(timer)
  }, [reduceMotion, hovered, focused, manuallyPaused, activeSlide])

  const showSlide = direction => setActiveSlide(current => (current + direction + slides.length) % slides.length)
  const onCarouselKeyDown = event => {
    if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); showSlide(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); showSlide(1) }
  }

  return <div className="home-refresh">
    <section className={`home-hero ${manuallyPaused ? 'is-paused' : ''}`} role="region" aria-roledescription="carousel" aria-label="AeroSwift logistics highlights" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }} onKeyDown={onCarouselKeyDown}>
      <AnimatePresence initial={false} mode="sync">
        <motion.img key={slide.image} className="home-hero-photo" src={slide.image} alt={slide.alt} draggable="false" initial={reduceMotion ? false : { opacity: 0, scale: 1.035 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </AnimatePresence>
      <div className="home-hero-shade" aria-hidden="true" />
      <div className="home-hero-inner container">
        <div className="home-hero-copy">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={activeSlide} className="home-slide-copy" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -12 }} transition={{ duration: reduceMotion ? 0 : 0.35 }} aria-live={manuallyPaused || focused ? 'polite' : 'off'} aria-atomic="true" role="group" aria-roledescription="slide" aria-label={`${activeSlide + 1} of ${slides.length}`}>
              <span className="home-hero-eyebrow"><i/> {slide.eyebrow}</span>
              <h1>{slide.title}<br/><em>{slide.accent}</em></h1>
              <p>{slide.copy}</p>
              <div className="home-hero-actions"><Link className="home-button home-button-yellow" to={slide.href}>{slide.action} <ArrowUpRight size={17}/></Link><Link className="home-text-link" to={slide.linkHref}>{slide.link} <ArrowRight size={16}/></Link></div>
            </motion.div>
          </AnimatePresence>
          <div className="home-proof"><span><Globe2 size={16}/> International shipping support</span><span><ShieldCheck size={16}/> Clear, practical communication</span></div>
        </div>
        <TrackingCard/>
      </div>
      <Link className="home-scroll" to="/services">EXPLORE AEROSWIFT <ArrowDownRight size={16}/></Link>
      <div className="home-carousel-controls" role="group" aria-label="Carousel controls">
        <button className="home-carousel-arrow" type="button" onClick={() => showSlide(-1)} aria-label="Previous slide"><ChevronLeft size={18}/></button>
        <div className="home-carousel-dots" role="group" aria-label="Choose a slide">{slides.map((item, index) => <button key={item.eyebrow} type="button" className={`home-carousel-dot ${index === activeSlide ? 'active' : ''}`} onClick={() => setActiveSlide(index)} aria-label={`Show slide ${index + 1}: ${item.title}`} aria-current={index === activeSlide ? 'true' : undefined}><span>{String(index + 1).padStart(2, '0')}</span><i key={`${index}-${activeSlide}`} /></button>)}</div>
        <button className="home-carousel-arrow" type="button" onClick={() => showSlide(1)} aria-label="Next slide"><ChevronRight size={18}/></button>
        <button className="home-carousel-pause" type="button" onClick={() => setManuallyPaused(!manuallyPaused)} aria-label={manuallyPaused ? 'Play carousel' : 'Pause carousel'} title={manuallyPaused ? 'Play carousel' : 'Pause carousel'}>{manuallyPaused ? <Play size={14}/> : <Pause size={14}/>}</button>
      </div>
      <span className="home-hero-index">{String(activeSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
    </section>

    <div className="home-capability-rail" role="group" aria-label="AeroSwift service categories">
      <div className="home-capability-window" aria-hidden="true"><div className="home-capability-track">{[0,1].map(copy=><div className="home-capability-set" key={copy}><span>PARCEL SHIPPING</span><i/><span>AIR FREIGHT</span><i/><span>OCEAN CARGO</span><i/><span>SHIPMENT VISIBILITY</span><i/><span>FLIGHT ENQUIRIES</span><i/></div>)}</div></div>
    </div>

    <section className="home-services section" id="services">
      <div className="container">
        <div className="home-section-heading">
          <div><span className="home-kicker">WHAT WE CAN HELP WITH</span><h2>Logistics that fits<br/><em>the journey.</em></h2></div>
          <div className="home-section-intro"><p>From a single parcel to freight that needs careful coordination, start with the service you need and talk with our team about the details.</p><Link to="/services" className="home-inline-link">See all services <ArrowRight size={16}/></Link></div>
        </div>
        <div className="home-service-grid">{services.map(({number,title,text,icon:Icon,image,link,label}) => <Link className="home-service-card" to={link} key={title}>
          <img src={image} alt="" loading="lazy"/><span className="home-card-shade"/><span className="home-card-number">{number}</span><span className="home-card-content"><span className="home-card-label">{label}</span><b>{title}</b><span>{text}</span><i><Icon size={18}/><ArrowUpRight size={16}/></i></span>
        </Link>)}</div>
      </div>
    </section>

    <section className="home-editorial">
      <div className="home-editorial-image"><img src="/aeroswift-warehouse.jpg" alt="Freight and packages in a distribution warehouse" loading="lazy"/><div className="home-route-overlay" role="img" aria-label="Illustrative shipment flow from origin, through a gateway, to destination"><div className="home-route-topline"><span>SHIPMENT FLOW</span><span>01 — 03</span></div><svg viewBox="0 0 420 92" fill="none" aria-hidden="true"><path className="home-route-path" d="M27 66C105 66 91 24 184 27s98 42 207-7"/><circle cx="27" cy="66" r="6"/><circle cx="184" cy="27" r="6"/><circle cx="391" cy="20" r="6"/></svg><div className="home-route-labels"><span>ORIGIN</span><span>GATEWAY</span><span>DESTINATION</span></div><small>Illustrative route flow · Not live tracking</small></div><span>GLOBAL MOVEMENT, HUMAN THINKING</span></div>
      <div className="home-editorial-copy"><span className="home-kicker">A MORE CONSIDERED APPROACH</span><h2>Behind every shipment<br/>is a <em>real business.</em></h2><p>Good logistics is more than moving goods. It is understanding what matters, coordinating the right details and keeping communication open when plans are in motion.</p><ul><li><Clock3 size={18}/><span><b>Responsive support</b><small>Talk through your shipment requirements with our team.</small></span></li><li><Boxes size={18}/><span><b>Practical coordination</b><small>Get help with routing, handling and the next steps.</small></span></li><li><Globe2 size={18}/><span><b>Connected journeys</b><small>Parcel and freight options for international movements.</small></span></li></ul><Link className="home-inline-link" to="/about">Get to know AeroSwift <ArrowRight size={16}/></Link></div>
    </section>

    <section className="home-process section">
      <div className="container"><div className="home-section-heading home-process-heading"><div><span className="home-kicker">HOW IT WORKS</span><h2>Clear steps.<br/><em>Better prepared.</em></h2></div><p>We keep the process straightforward: tell us what you need, get a human follow-up, and use available shipment updates to stay informed.</p></div>
        <div className="home-step-grid">{steps.map(([n,title,text]) => <article className="home-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight size={18}/></article>)}</div>
      </div>
    </section>

    <section className="home-cta"><div className="container home-cta-inner"><div><span className="home-kicker">YOUR NEXT MOVE STARTS HERE</span><h2>Tell us where it<br/>needs to <em>go.</em></h2><p>Share your route and shipment details. We’ll help you understand the right next step.</p></div><div className="home-cta-actions"><Link to="/shipping" className="home-button home-button-yellow">Request shipping support <ArrowUpRight size={17}/></Link><Link to="/contact" className="home-cta-contact">Have a different question? Contact us <ArrowRight size={15}/></Link></div></div></section>
  </div>
}
