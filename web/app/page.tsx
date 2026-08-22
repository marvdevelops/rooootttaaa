import type { Metadata } from 'next';
import Image from 'next/image';
import {
  Bike,
  Boxes,
  CheckCircle2,
  Compass,
  Footprints,
  LineChart,
  Mountain,
  NotebookPen,
  RotateCcw,
  Share2,
  Trophy,
  Upload,
  Users,
  Watch,
  Zap,
} from 'lucide-react';
import Reveal from './Reveal';
import ScreensCarousel from './ScreensCarousel';
import WaitlistForm from './WaitlistForm';

export const metadata: Metadata = {
  title: 'Rootah — Your next route, in under a minute.',
  description:
    'Tap your start. Tap your stops. Rootah connects them along real streets and trails, with live distance and elevation as you go. The first route planning app launched in the Philippines.',
};

const NAV_LINK_STYLE: React.CSSProperties = { fontWeight: 600, fontSize: 15, color: '#1A1614' };

function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: '#E84B2A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(232,75,42,.35)',
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.58} height={(size * 0.58 * 140) / 120} viewBox="-8 -4 116 136">
        <path
          d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
          stroke="#FFFFFF"
          strokeWidth={10}
          fill="none"
          strokeLinecap="square"
        />
        <circle cx={26} cy={24} r={22} fill="#FFFFFF" />
        <circle cx={74} cy={104} r={19} fill="#FFFFFF" />
        <circle cx={74} cy={104} r={5} fill="#E84B2A" />
      </svg>
    </div>
  );
}

function ComingSoonBadge({ dark = false, platform }: { dark?: boolean; platform: 'ios' | 'android' }) {
  const bg = dark ? '#1A1614' : '#FFFFFF';
  const fg = dark ? '#F2EDE5' : '#1A1614';
  const iconBg = platform === 'ios' ? '#E84B2A' : '#4BABB8';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: bg,
        borderRadius: 50,
        boxShadow: dark ? '0 4px 16px rgba(0,0,0,.28)' : '0 2px 12px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06)',
        padding: '10px 20px 10px 10px',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {platform === 'ios' ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M16.5 1c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.2 1.5-.1-1.1.4-2.3 1.1-3.1.8-.9 2.1-1.6 3.2-1.7zm3.9 16.5c-.6 1.3-.9 1.9-1.7 3.1-1.1 1.6-2.6 3.6-4.5 3.6-1.7 0-2.1-1.1-4.3-1.1-2.2 0-2.7 1.1-4.4 1.1-1.9 0-3.3-1.8-4.4-3.4-3-4.4-3.3-9.5-1.5-12.2 1.3-1.9 3.3-3.1 5.2-3.1 1.9 0 3.1 1.1 4.7 1.1 1.5 0 2.4-1.1 4.6-1.1 1.7 0 3.5.9 4.8 2.5-4.2 2.3-3.5 8.3 1.5 9.5z" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M3 20.5V3.5a1 1 0 0 1 1.5-.9l13.6 8.5a1 1 0 0 1 0 1.8L4.5 21.4a1 1 0 0 1-1.5-.9z" />
          </svg>
        )}
      </div>
      <span style={{ color: fg, lineHeight: 1.15, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 600, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Coming soon on
        </span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px' }}>
          {platform === 'ios' ? 'the App Store' : 'Google Play'}
        </span>
      </span>
    </div>
  );
}

const CREDIBILITY_ITEMS = [
  'Routes follow real streets, not straight lines',
  'Live elevation updates as you plan',
  'GPX export for Garmin and Coros',
  'Road and trail compatible',
];

interface IconCard {
  bg: string;
  fg: string;
  icon: React.ElementType;
  title: string;
  body: string;
}

const WHO_CARDS: IconCard[] = [
  { bg: '#E84B2A', fg: '#FFFFFF', icon: Footprints, title: 'Weekend runners', body: 'Plan a fresh loop from home without guessing distance or dodging dead ends.' },
  { bg: '#E8923A', fg: '#FFFFFF', icon: Bike, title: 'Cyclists chasing distance', body: 'Map a long ride across barangays and highways, then check the climbs before you commit.' },
  { bg: '#4BABB8', fg: '#FFFFFF', icon: Users, title: 'Run club organizers', body: 'Name a route once, schedule a group run on it, and let people RSVP in one place.' },
  { bg: '#1A1614', fg: '#F2EDE5', icon: Watch, title: 'Garmin and Coros owners', body: 'Build on your phone, export a clean GPX file, and load it straight onto your watch.' },
];

const FEATURES: IconCard[] = [
  { bg: '#E84B2A', fg: '#FFFFFF', icon: Mountain, title: 'Color-coded hills', body: 'Your route is shaded by how steep each section is, so you can see the climbs before you run them.' },
  { bg: '#E8923A', fg: '#FFFFFF', icon: RotateCcw, title: 'Close the loop in one tap', body: 'Building a loop? One button routes you back to your start point.' },
  { bg: '#4BABB8', fg: '#FFFFFF', icon: LineChart, title: 'Elevation preview before you save', body: 'See the full elevation chart before you commit to the route.' },
  { bg: '#1A1614', fg: '#F2EDE5', icon: Upload, title: 'GPX import', body: 'Have a route from Strava, Garmin, or Komoot? Import it and use it as your starting point.' },
  { bg: '#E84B2A', fg: '#FFFFFF', icon: Zap, title: 'Flyby', body: 'Watch a 3D flythrough of your route on a terrain map before you run it. Useful for checking out a new trail.' },
  { bg: '#E8923A', fg: '#FFFFFF', icon: NotebookPen, title: 'Waypoint notes', body: 'Drop a note on any point, like a water stop or where to turn, so your route doubles as a training plan.' },
  { bg: '#4BABB8', fg: '#FFFFFF', icon: Share2, title: 'Share with friends', body: 'Send a route to anyone with a link. They can see the full map and stats without needing the app.' },
  { bg: '#1A1614', fg: '#F2EDE5', icon: Boxes, title: '3D and satellite view', body: 'Switch to a 3D terrain view or satellite imagery to scout the ground before you commit to a route.' },
];

interface StepCard {
  bg: string;
  fg: string;
  n: number;
  title: string;
  body: string;
}

const STEPS: StepCard[] = [
  { bg: '#E84B2A', fg: '#FFFFFF', n: 1, title: 'Tap the map', body: 'Drop your start point. Keep tapping to add stops. Rootah routes between each one along real streets.' },
  { bg: '#E8923A', fg: '#FFFFFF', n: 2, title: 'Adjust until it looks right', body: 'Drag any point to reshape the route. Switch to satellite view. Try 3D to see the terrain. Add or remove stops anytime.' },
  { bg: '#4BABB8', fg: '#FFFFFF', n: 3, title: 'Save and go', body: 'Save with one tap. Export as GPX to your Garmin or Coros. Or share it publicly so other runners in your city can find it.' },
];

const SCREENS = [
  { src: '/landing/empty-state.jpeg', alt: 'Picking a route or starting a new one for a group run', shadowColor: '#4BABB8' },
  { src: '/landing/route-line.jpeg', alt: 'Building a route on the map with live distance, gain, and peak elevation', shadowColor: '#E84B2A' },
  { src: '/landing/route-details.jpeg', alt: 'Route detail with stats and one-tap "I ran this" logging', shadowColor: '#4BABB8' },
  { src: '/landing/discover-map.jpeg', alt: 'Discovering routes across the Philippines', shadowColor: '#E8923A' },
  { src: '/landing/filters.jpeg', alt: 'Flyby preview of a route with map style options', shadowColor: '#1A1614' },
  { src: '/landing/activity.jpeg', alt: 'Flyby flying along the route in real time', shadowColor: '#E84B2A' },
];

function PillButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost-dark' | 'ghost-light';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: '#E84B2A',
      color: '#FFFFFF',
      boxShadow: '0 4px 16px rgba(232,75,42,.3)',
    },
    'ghost-dark': {
      background: 'transparent',
      color: '#F2EDE5',
      border: '1.5px solid rgba(255,255,255,.25)',
    },
    'ghost-light': {
      background: 'transparent',
      color: '#1A1614',
      border: '1.5px solid rgba(0,0,0,.15)',
    },
  };
  return (
    <a
      href={href}
      className="nav-link soft-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.02em',
        borderRadius: 50,
        padding: '13px 26px',
        lineHeight: 1,
        ...styles[variant],
      }}
    >
      {children}
    </a>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', color: '#E84B2A' }}>{children}</span>
  );
}

function IconCardGrid({ cards }: { cards: IconCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.07)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                background: card.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} color={card.fg} strokeWidth={1.8} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>{card.title}</span>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: '#8C8078' }}>{card.body}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAV */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(242,237,229,.92)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 1px 0 rgba(0,0,0,.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px clamp(20px,5vw,64px)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo />
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>rootah</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,32px)', flexWrap: 'wrap' }}>
          <a href="#how" className="nav-link" style={NAV_LINK_STYLE}>How it works</a>
          <a href="#clubs" className="nav-link" style={NAV_LINK_STYLE}>For clubs</a>
          <a href="/explore" className="nav-link" style={NAV_LINK_STYLE}>Explore</a>
          <PillButton href="#download">DOWNLOAD</PillButton>
        </div>
      </div>

      {/* HERO */}
      <div
        style={{
          padding: 'clamp(48px,8vw,100px) clamp(20px,5vw,64px) clamp(24px,4vw,40px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 'clamp(32px,5vw,64px)',
          alignItems: 'center',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(40px,6.5vw,76px)', lineHeight: 1.06, fontWeight: 800, letterSpacing: '-1.5px' }}>
            Map it, Run it, Own it.
          </h1>
          <p style={{ margin: 0, fontSize: 'clamp(18px,2.1vw,22px)', lineHeight: 1.65, color: '#8C8078', maxWidth: 600, fontWeight: 400 }}>
            Tap your start. Tap your stops. Rootah connects them along real streets and trails, with live distance
            and elevation as you go. No more estimating. No more switching apps.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            <ComingSoonBadge dark platform="ios" />
            <ComingSoonBadge dark platform="android" />
          </div>
          <span style={{ fontSize: 13, color: '#8C8078', fontWeight: 500 }}>
            The first route planning app launched in the Philippines.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 340,
              background: '#1A1614',
              borderRadius: 40,
              boxShadow: '0 24px 60px rgba(0,0,0,.28), 0 8px 24px rgba(232,75,42,.15)',
              padding: 10,
              transform: 'rotate(1.5deg)',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/landing/main-screen.jpeg"
              alt="Rootah's discover map showing routes and group runs across the Philippines"
              width={800}
              height={1734}
              priority
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 32 }}
            />
          </div>
        </div>
      </div>

      {/* CREDIBILITY BAR */}
      <div style={{ padding: '0 clamp(20px,5vw,64px) clamp(48px,7vw,80px)', maxWidth: 1440, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px 32px',
            background: '#FFFFFF',
            borderRadius: 20,
            boxShadow: '0 2px 10px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.07)',
            padding: '20px 28px',
          }}
        >
          {CREDIBILITY_ITEMS.map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={17} color="#4BAB7A" strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1614' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <div id="about" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', background: '#FFFFFF', scrollMarginTop: 88 }}>
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
              <SectionEyebrow>STILL BUILDING ROUTES IN GOOGLE MAPS?</SectionEyebrow>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.15 }}>
                There is a better way.
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#5B5548' }}>
                You drop a pin. You trace a path. You switch to another app to check elevation. You screenshot it.
                Later, you can&apos;t remember which version you saved.
              </p>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#5B5548' }}>
                Rootah was built by Filipino runners who were tired of doing it the hard way. It handles the
                routing, the elevation, and the watch export, so you can focus on the run.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* VALUE PROPOSITION */}
      <div style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <SectionEyebrow>TAP. ROUTE. DONE.</SectionEyebrow>
            <h2 style={{ margin: 0, fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px', maxWidth: 760 }}>
              Real roads and trails, not straight lines through someone&apos;s backyard.
            </h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#5B5548', maxWidth: 660 }}>
              Rootah connects your points along real streets. Drag any point to adjust the route, and only the two
              segments around it update, so it stays fast. Distance and elevation update with every change, so you
              know exactly what you&apos;re getting into before you head out.
            </p>
          </div>
        </Reveal>
      </div>

      {/* WHO IT'S FOR */}
      <div id="who" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', maxWidth: 1400, margin: '0 auto', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
            <SectionEyebrow>WHO IT IS FOR</SectionEyebrow>
            <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px' }}>
              Built for anyone who plans a route before they move.
            </h2>
          </div>
          <IconCardGrid cards={WHO_CARDS} />
        </Reveal>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', background: '#FFFFFF', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
              <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px' }}>
                Three steps to your next run.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  style={{
                    background: '#F7F3ED',
                    borderRadius: 20,
                    boxShadow: '0 2px 10px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.05)',
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 15,
                      background: step.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 19,
                      color: step.fg,
                    }}
                  >
                    {step.n}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>{step.title}</span>
                  <span style={{ fontSize: 15, lineHeight: 1.6, color: '#8C8078' }}>{step.body}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* FEATURES */}
      <div style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', maxWidth: 1400, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
            <SectionEyebrow>FEATURES</SectionEyebrow>
            <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px' }}>
              Built for how runners actually plan.
            </h2>
          </div>
          <IconCardGrid cards={FEATURES} />
        </Reveal>
      </div>

      {/* APP SCREENS */}
      <div id="screens" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5vw,48px)' }}>
              <SectionEyebrow>SEE IT IN ACTION</SectionEyebrow>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px' }}>
                The real app, on real streets.
              </h2>
            </div>
            <ScreensCarousel screens={SCREENS} />
          </div>
        </Reveal>
      </div>

      {/* DISCOVERY */}
      <div style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', background: '#FFFFFF' }}>
        <Reveal>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(32px,5vw,64px)', alignItems: 'start' }}>
            <div>
              <SectionEyebrow>DISCOVER</SectionEyebrow>
              <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(30px,4.2vw,50px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.15 }}>
                Find routes other runners love.
              </h2>
              <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.75, color: '#5B5548' }}>
                Browse public routes near you on the Discover map. Filter by distance, elevation, or city. See which
                routes are most saved, most liked, and most completed.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: '#4BABB8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Compass size={21} color="#FFFFFF" strokeWidth={1.8} />
                </div>
                <div>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px' }}>Runs near you</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: '#8C8078' }}>
                    See upcoming group runs close to where you are browsing, updated as you move the map.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: '#E8923A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy size={21} color="#FFFFFF" strokeWidth={1.8} />
                </div>
                <div>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px' }}>Local Legend</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: '#8C8078' }}>
                    The runner with the most logged completions on a route earns the Local Legend title for that
                    route.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* RUN CLUBS */}
      <div id="clubs" style={{ padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,64px)', scrollMarginTop: 88 }}>
        <Reveal>
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              background: '#1A1614',
              borderRadius: 28,
              padding: 'clamp(36px,6vw,64px)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#E84B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} color="#FFFFFF" strokeWidth={1.8} />
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px', color: '#F2EDE5' }}>
              Running is better together.
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#B0A898', maxWidth: 620 }}>
              Create your club on Rootah. Build a route collection for your members. Schedule group runs, weekly or
              one-off. Manage RSVPs and keep your community in one place. Every event gets a public page. Every
              route gets a shareable link with a full map and stats.
            </p>
            <PillButton href="#download">START YOUR CLUB</PillButton>
          </div>
        </Reveal>
      </div>

      {/* TRUST */}
      <div style={{ padding: '0 clamp(20px,5vw,64px) clamp(64px,9vw,120px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <SectionEyebrow>THE FIRST ROUTE APP LAUNCHED IN THE PHILIPPINES</SectionEyebrow>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#5B5548', maxWidth: 680 }}>
              Rootah started in Manila. It knows the roads, the trails, and the cities here. This is not a global
              app with the Philippines added as an afterthought. It was built here first.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 32px', justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 14, color: '#1A1614' }}>
                <strong>Free to use.</strong> Build routes, discover others, and join group runs at no cost. Pro
                unlocks unlimited saves, GPX import, and more.
              </span>
            </div>
            <span style={{ fontSize: 14, color: '#1A1614' }}>
              <strong>Road and trail compatible.</strong> Route runs, rides, and hikes across streets and trails alike.
            </span>
          </div>
        </Reveal>
      </div>

      {/* DOWNLOAD */}
      <div id="download" style={{ background: '#1A1614', padding: 'clamp(64px,9vw,110px) clamp(20px,5vw,64px)', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(32px,4.6vw,54px)', fontWeight: 800, letterSpacing: '-1px', color: '#F2EDE5' }}>
              Start planning your next run.
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: '#B0A898', maxWidth: 540, lineHeight: 1.6 }}>
              Free to download. Works on iOS and Android. Your first route takes under a minute.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <ComingSoonBadge platform="ios" />
              <ComingSoonBadge platform="android" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16, width: '100%' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F2EDE5' }}>
                Sign up for the waitlist to know the moment we launch.
              </span>
              <WaitlistForm />
            </div>
            <span style={{ fontSize: 14, color: '#B0A898' }}>
              Questions?{' '}
              <a href="mailto:hello@rootah.com" className="nav-link" style={{ color: '#F2EDE5', fontWeight: 700 }}>
                hello@rootah.com
              </a>
            </span>
          </div>
        </Reveal>
      </div>

      {/* FOOTER */}
      <div id="contact" style={{ padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,64px) 40px', background: '#F2EDE5', scrollMarginTop: 88 }}>
        <Reveal>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Logo size={28} />
                <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>rootah</span>
              </div>
              <span style={{ fontSize: 14, color: '#8C8078', maxWidth: 420 }}>
                The first route planning app launched in the Philippines.
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', color: '#E84B2A' }}>LINKS</span>
              <a href="/terms" className="nav-link" style={{ fontSize: 15, color: '#1A1614', fontWeight: 600 }}>Terms &amp; conditions</a>
              <a href="/privacy" className="nav-link" style={{ fontSize: 15, color: '#1A1614', fontWeight: 600 }}>Privacy policy</a>
              <a href="/delete-account" className="nav-link" style={{ fontSize: 15, color: '#1A1614', fontWeight: 600 }}>Delete account</a>
            </div>
          </div>
          <div
            style={{
              maxWidth: 1200,
              margin: '40px auto 0',
              paddingTop: 20,
              borderTop: '1px solid rgba(0,0,0,.08)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 13, color: '#8C8078', fontWeight: 500 }}>
              © 2026 rootah. The first route planning app launched in the Philippines.
            </span>
            <a
              href="https://highbeam.digital"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
              style={{ fontSize: 13, color: '#8C8078', fontWeight: 500 }}
            >
              Powered by HighBeam Digital
            </a>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
