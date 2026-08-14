import type { Metadata } from 'next';
import Image from 'next/image';
import Reveal from './Reveal';
import ScreensCarousel from './ScreensCarousel';

export const metadata: Metadata = {
  title: 'Rootah — Map it. Run it. Own it.',
  description:
    'Tap a few points on the map and Rootah connects them along real streets and trails. Watch distance and elevation update live, then send the route to your watch.',
};

const NAV_LINK_STYLE: React.CSSProperties = { fontWeight: 600, fontSize: 15, color: '#222A2A' };

function Logo({ size = 46 }: { size?: number }) {
  return (
    <img
      src="/icon.png"
      alt="Rootah"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        border: '3px solid var(--ink)',
        boxShadow: '3px 3px 0 #222A2A',
        flexShrink: 0,
        objectFit: 'cover',
      }}
    />
  );
}

function ComingSoonBadge({ dark = false, platform }: { dark?: boolean; platform: 'ios' | 'android' }) {
  const shadowColor = dark ? (platform === 'ios' ? '#EC4624' : '#4FBBBC') : '#E2DAC2';
  const bg = dark ? '#222A2A' : platform === 'ios' ? '#EC4624' : '#4FBBBC';
  const border = dark ? '#222A2A' : '#E2DAC2';
  const fg = dark ? '#E2DAC2' : platform === 'ios' ? '#222A2A' : '#16302f';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: bg,
        border: `3px solid ${border}`,
        borderRadius: 14,
        boxShadow: `4px 4px 0 ${shadowColor}`,
        padding: dark ? '12px 20px' : '14px 22px',
        opacity: 0.9,
      }}
    >
      {platform === 'ios' ? (
        <svg width={dark ? 20 : 22} height={dark ? 20 : 22} viewBox="0 0 24 24" fill={fg}>
          <path d="M16.5 1c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.2 1.5-.1-1.1.4-2.3 1.1-3.1.8-.9 2.1-1.6 3.2-1.7zm3.9 16.5c-.6 1.3-.9 1.9-1.7 3.1-1.1 1.6-2.6 3.6-4.5 3.6-1.7 0-2.1-1.1-4.3-1.1-2.2 0-2.7 1.1-4.4 1.1-1.9 0-3.3-1.8-4.4-3.4-3-4.4-3.3-9.5-1.5-12.2 1.3-1.9 3.3-3.1 5.2-3.1 1.9 0 3.1 1.1 4.7 1.1 1.5 0 2.4-1.1 4.6-1.1 1.7 0 3.5.9 4.8 2.5-4.2 2.3-3.5 8.3 1.5 9.5z" />
        </svg>
      ) : (
        <svg width={dark ? 20 : 22} height={dark ? 20 : 22} viewBox="0 0 24 24" fill={fg}>
          <path d="M3 20.5V3.5a1 1 0 0 1 1.5-.9l13.6 8.5a1 1 0 0 1 0 1.8L4.5 21.4a1 1 0 0 1-1.5-.9z" />
        </svg>
      )}
      <span style={{ fontFamily: 'var(--font-body)', color: fg, lineHeight: 1.1, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: dark ? 10 : 11 }}>Coming soon on</span>
        <span style={{ display: 'block', fontSize: dark ? 16 : 17, fontWeight: 700 }}>
          {platform === 'ios' ? 'the App Store' : 'Google Play'}
        </span>
      </span>
    </div>
  );
}

interface WhoCard {
  bg: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}

const WHO_CARDS: WhoCard[] = [
  {
    bg: '#EC4624',
    title: 'Weekend runners',
    body: 'Plan a fresh loop from home without guessing distance or dodging dead ends.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="14" cy="4.5" r="2" fill="#E2DAC2" />
        <path d="M9 21l2.5-5 2-2-1-4-3 1-2 3.5M11 12l3-1.5 3 2.5 3-1M8 14l-3 1.5" stroke="#E2DAC2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    bg: '#F39120',
    title: 'Cyclists chasing distance',
    body: 'Map a long ride across barangays and highways, then check the climbs before you commit.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="5.5" cy="17.5" r="3.5" stroke="#222A2A" strokeWidth="2" />
        <circle cx="18.5" cy="17.5" r="3.5" stroke="#222A2A" strokeWidth="2" />
        <circle cx="15" cy="6" r="1.4" fill="#222A2A" />
        <path d="M12 17.5V14l-3-3 4-3 2 3h3" stroke="#222A2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 11l3-3" stroke="#222A2A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    bg: '#4FBBBC',
    title: 'Run club organizers',
    body: 'Name a route once, schedule a group run on it, and let people RSVP in one place.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="8" r="3" stroke="#16302f" strokeWidth="2" />
        <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#16302f" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17.5" cy="7" r="2.3" stroke="#16302f" strokeWidth="2" />
        <path d="M14.5 20c0-2.8 1.7-5.2 4-6.2" stroke="#16302f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    bg: '#222A2A',
    title: 'Garmin and Coros owners',
    body: 'Build on your phone, export a clean GPX file, and load it straight onto your watch.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="7" y="7" width="10" height="10" rx="3" stroke="#E2DAC2" strokeWidth="2" />
        <path d="M9 7V4.5h6V7M9 17v2.5h6V17" stroke="#E2DAC2" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 10v2l1.5 1" stroke="#E2DAC2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface StepCard {
  bg: string;
  fg: string;
  n: number;
  title: string;
  body: string;
}

const STEPS: StepCard[] = [
  { bg: '#EC4624', fg: '#E2DAC2', n: 1, title: 'Tap to place points', body: 'Your first tap sets the start. Every tap after that adds a stop.' },
  { bg: '#F39120', fg: '#222A2A', n: 2, title: 'Rootah connects the dots', body: 'Each point routes along real streets and paths automatically, no straight lines.' },
  { bg: '#4FBBBC', fg: '#16302f', n: 3, title: 'Drag to reshape', body: 'Move any point and the route reroutes itself, with distance and elevation updating live.' },
  { bg: '#222A2A', fg: '#E2DAC2', n: 4, title: 'Export and go', body: 'Send your route to Garmin or Coros as a GPX file, or name it and organize a group run.' },
];

const SCREENS = [
  { src: '/landing/empty-state.jpeg', alt: 'Empty map prompting you to tap and start a route', shadowColor: '#4FBBBC' },
  { src: '/landing/route-line.jpeg', alt: 'Building a route on the map with live distance, gain, and peak elevation', shadowColor: '#EC4624' },
  { src: '/landing/route-details.jpeg', alt: 'Saving a route with an elevation profile', shadowColor: '#4FBBBC' },
  { src: '/landing/discover-map.jpeg', alt: 'Discovering routes across the Philippines', shadowColor: '#F39120' },
  { src: '/landing/filters.jpeg', alt: 'Filtering routes by distance, elevation, and city', shadowColor: '#222A2A' },
  { src: '/landing/activity.jpeg', alt: 'Activity feed showing recently created routes', shadowColor: '#EC4624' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAV */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#F2EEE2',
          borderBottom: '3px solid #222A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '20px clamp(20px,5vw,64px)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>rootah</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,32px)', flexWrap: 'wrap' }}>
          <a href="#about" className="nav-link" style={NAV_LINK_STYLE}>About</a>
          <a href="#who" className="nav-link" style={NAV_LINK_STYLE}>Who it&apos;s for</a>
          <a href="#how" className="nav-link" style={NAV_LINK_STYLE}>How it works</a>
          <a href="#contact" className="nav-link" style={NAV_LINK_STYLE}>Contact</a>
          <a
            href="#download"
            className="brutal-btn"
            style={
              {
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                background: '#EC4624',
                color: '#E2DAC2',
                border: '3px solid #222A2A',
                borderRadius: 10,
                boxShadow: '3px 3px 0 #222A2A',
                padding: '9px 16px',
                '--hover-shadow': '5px 5px 0 #222A2A',
                '--active-shadow': '1px 1px 0 #222A2A',
              } as React.CSSProperties
            }
          >
            COMING SOON
          </a>
        </div>
      </div>

      {/* HERO */}
      <div
        style={{
          padding: 'clamp(48px,8vw,100px) clamp(20px,5vw,64px) clamp(40px,6vw,80px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 'clamp(32px,5vw,64px)',
          alignItems: 'center',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>
            LAUNCHING FIRST IN THE PHILIPPINES
          </span>
          <h1 style={{ margin: 0, fontSize: 'clamp(44px,7.5vw,92px)', lineHeight: 1.05, fontFamily: 'var(--font-display)' }}>
            Map it. Run it. Own it.
          </h1>
          <p style={{ margin: 0, fontSize: 'clamp(19px,2.2vw,25px)', lineHeight: 1.65, color: '#4a4438', maxWidth: 620 }}>
            Tap a few points on the map and rootah connects them along real streets and trails, not straight lines
            through someone&apos;s backyard. Watch distance and elevation update live, then send the route straight
            to your watch.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            <ComingSoonBadge dark platform="ios" />
            <ComingSoonBadge dark platform="android" />
          </div>
          <span style={{ fontSize: 13, color: '#6b5d50' }}>Free to build a route. No sign up needed to start.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#222A2A',
              border: '4px solid #222A2A',
              borderRadius: 32,
              boxShadow: '14px 14px 0 #222A2A',
              padding: 8,
              transform: 'rotate(2deg)',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/landing/route-line.jpeg"
              alt="Rootah route builder showing a route across real streets"
              width={738}
              height={1600}
              priority
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 26 }}
            />
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div
        id="about"
        style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', background: '#E2DAC2', borderTop: '3px solid #222A2A', borderBottom: '3px solid #222A2A', scrollMarginTop: 88 }}
      >
        <Reveal>
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
              gap: 'clamp(32px,5vw,64px)',
              alignItems: 'start',
            }}
          >
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>ABOUT US</span>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(32px,4.5vw,54px)', fontFamily: 'var(--font-display)', lineHeight: 1.15 }}>
                Built by people tired of planning routes the slow way.
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.8, color: '#3d372c' }}>
                Rootah started in Manila with one problem: planning a route before a run took longer than the run
                itself. Straight-line distance calculators didn&apos;t know about rivers, gates, or dead ends. So we
                built an app that follows real roads and paths from the first tap.
              </p>
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.8, color: '#3d372c' }}>
                We are runners and cyclists first, developers second. Every part of rootah exists because we needed
                it on our own routes around Metro Manila. It is launching here first, with the rest of the region
                close behind.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* WHO IT'S FOR */}
      <div id="who" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', maxWidth: 1400, margin: '0 auto', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>WHO IT IS FOR</span>
            <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(32px,4.5vw,54px)', fontFamily: 'var(--font-display)' }}>
              Built for anyone who plans a route before they move.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {WHO_CARDS.map((card) => (
              <div
                key={card.title}
                style={{
                  background: '#E2DAC2',
                  border: '3px solid #222A2A',
                  borderRadius: 16,
                  boxShadow: '5px 5px 0 #222A2A',
                  padding: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: card.bg,
                    border: '3px solid #222A2A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{card.title}</span>
                <span style={{ fontSize: 15, lineHeight: 1.6, color: '#5b5548' }}>{card.body}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', maxWidth: 1400, margin: '0 auto', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>HOW IT WORKS</span>
            <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(32px,4.5vw,54px)', fontFamily: 'var(--font-display)' }}>
              From empty map to finished route in four taps.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {STEPS.map((step) => (
              <div
                key={step.n}
                style={{
                  background: '#FFFFFF',
                  border: '3px solid #222A2A',
                  borderRadius: 16,
                  boxShadow: '5px 5px 0 #222A2A',
                  padding: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: step.bg,
                    border: '3px solid #222A2A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    color: step.fg,
                  }}
                >
                  {step.n}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{step.title}</span>
                <span style={{ fontSize: 16, lineHeight: 1.65, color: '#5b5548' }}>{step.body}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* APP SCREENS */}
      <div
        id="screens"
        style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', background: '#E2DAC2', borderTop: '3px solid #222A2A', borderBottom: '3px solid #222A2A', scrollMarginTop: 88 }}
      >
        <Reveal>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>SEE IT IN ACTION</span>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(32px,4.5vw,54px)', fontFamily: 'var(--font-display)' }}>
                The real app, on real streets.
              </h2>
            </div>
            <ScreensCarousel screens={SCREENS} />
          </div>
        </Reveal>
      </div>

      {/* DOWNLOAD */}
      <div id="download" style={{ background: '#222A2A', padding: 'clamp(64px,9vw,110px) clamp(20px,5vw,64px)', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(34px,5vw,58px)', fontFamily: 'var(--font-display)', color: '#E2DAC2' }}>
              Rootah is coming soon.
            </h2>
            <p style={{ margin: 0, fontSize: 18, color: '#c9bfa2', maxWidth: 540 }}>
              We&apos;re putting the finishing touches on iOS and Android. Say hello and we&apos;ll let you know the
              moment it&apos;s live.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <ComingSoonBadge platform="ios" />
              <ComingSoonBadge platform="android" />
            </div>
            <a
              href="#contact"
              className="nav-link brutal-btn"
              style={
                {
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  background: 'transparent',
                  color: '#E2DAC2',
                  border: '3px solid #E2DAC2',
                  borderRadius: 10,
                  padding: '10px 18px',
                  '--hover-shadow': '3px 3px 0 #E2DAC2',
                  '--active-shadow': '0 0 0 #E2DAC2',
                } as React.CSSProperties
              }
            >
              GET NOTIFIED
            </a>
          </div>
        </Reveal>
      </div>

      {/* CONTACT / FOOTER */}
      <div id="contact" style={{ padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,64px) 40px', background: '#F2EEE2', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>CONTACT</span>
              <h3 style={{ margin: 0, fontSize: 30, fontFamily: 'var(--font-display)' }}>
                Questions, feedback, partnerships. Just say hello.
              </h3>
              <a href="mailto:hello@rootah.com" className="nav-link" style={{ fontSize: 19, fontWeight: 700 }}>
                hello@rootah.com
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#EC4624' }}>LINKS</span>
              <a href="#about" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>About</a>
              <a href="#how" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>How it works</a>
              <a href="#download" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>Download</a>
              <a href="/terms" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>Terms &amp; conditions</a>
              <a href="/privacy" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>Privacy policy</a>
              <a href="/delete-account" className="nav-link" style={{ fontSize: 15, color: '#222A2A', fontWeight: 600 }}>Delete account</a>
            </div>
          </div>
          <div
            style={{
              maxWidth: 1200,
              margin: '40px auto 0',
              paddingTop: 20,
              borderTop: '3px solid #222A2A',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 13, color: '#6b5d50' }}>© 2026 rootah. Made for runners and cyclists in the Philippines.</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>rootah</span>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
