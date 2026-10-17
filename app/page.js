import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { Disclaimer } from "@/components/ui";

function ServiceIcon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.65,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: "false",
  };

  const paths = {
    identity: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.7-3.1 3.1-4.7 6.5-4.7s5.8 1.6 6.5 4.7" /><path d="M18.5 5.5h2M19.5 4.5v2" /></>,
    land: <><path d="m3.5 8 6-3 5 2 6-3v12l-6 3-5-2-6 3z" /><path d="M9.5 5v12M14.5 7v12" /><path d="m6.2 10.5 1.1 1.1 1.8-2" /></>,
    deed: <><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4M8.5 12h7M8.5 15h7M8.5 18h4" /></>,
    heirs: <><circle cx="9" cy="8" r="2.5" /><circle cx="17" cy="9" r="2" /><path d="M3.5 19c.4-3 2.4-4.5 5.5-4.5s5.1 1.5 5.5 4.5M14.5 14.5c2.9-.4 5.1 1.1 5.8 3.5" /></>,
    government: <><path d="m3 9 9-5 9 5" /><path d="M5 10h14M6.5 10v7M11 10v7M17.5 10v7M4 20h16M3.5 17h17" /></>,
    challan: <><rect x="4.5" y="3.5" width="15" height="17" rx="2" /><path d="M8 8h8M8 12h3M8 16h3" /><path d="m14 15 1.6 1.6L19 13" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

const services = [
  {
    icon: "identity",
    title: "পরিচয় যাচাই",
    description: "NID-সংক্রান্ত তথ্য ও নামের মিল পর্যালোচনা করে পরিচয়-সম্পর্কিত রেফারেন্স দেখুন।",
  },
  {
    icon: "land",
    title: "খতিয়ান ও পর্চা",
    description: "খতিয়ান, দাগ এবং জমির রেকর্ডের উপলভ্য রেফারেন্স তথ্য খুঁজে দেখুন।",
  },
  {
    icon: "deed",
    title: "পূর্ববর্তী দলিল",
    description: "পূর্ববর্তী দলিলের রেফারেন্স রেকর্ড খুঁজে নিয়ে তথ্যের ধারাবাহিকতা পর্যালোচনা করুন।",
  },
  {
    icon: "heirs",
    title: "ওয়ারিশ তথ্য",
    description: "ওয়ারিশ ও উত্তরাধিকার-সম্পর্কিত উপলভ্য রেফারেন্স তথ্য মিলিয়ে দেখুন।",
  },
  {
    icon: "government",
    title: "সরকারি স্বার্থ",
    description: "খাস জমি বা সরকারি স্বার্থ-সম্পর্কিত রেফারেন্স রেকর্ড আছে কি না দেখুন।",
  },
  {
    icon: "challan",
    title: "ই-চালান ও ফি",
    description: "ই-চালান এবং সংশ্লিষ্ট ফি-সংক্রান্ত উপলভ্য তথ্য পরীক্ষা করুন।",
  },
];

export default async function Home() {
  let profile = null;
  try { ({ profile } = await getSessionProfile()); } catch {}

  return (
    <div className="ldis-home">
      <section className="ldis-hero" aria-labelledby="ldis-hero-title">
        <div className="ldis-hero-inner">
          <div className="ldis-hero-copy">
            <p className="ldis-hero-eyebrow"><span aria-hidden="true" /> তথ্য যাচাইয়ের সহায়ক প্ল্যাটফর্ম</p>
            <h1 id="ldis-hero-title">জমি বিক্রির আগে <span>তথ্য যাচাই করুন</span></h1>
            <p className="ldis-hero-description">
              NID, পর্চা/খতিয়ান, পূর্ববর্তী দলিল, ওয়ারিশ সনদ, সরকারি স্বার্থ ও ই-চালানের তথ্য একই জায়গায় মিলিয়ে দেখুন — উৎস, ফলাফল ও অনিশ্চয়তাসহ।
            </p>
            <p className="ldis-hero-english">
              Check identity, land records, earlier deeds, government interest and fees in one place.
            </p>
            <div className="ldis-hero-actions">
              {profile ? (
                <Link href={homeFor(profile.role)} className="ldis-button ldis-button-primary">
                  ড্যাশবোর্ডে যান <span aria-hidden="true">↗</span>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="ldis-button ldis-button-primary">
                    লগইন <span aria-hidden="true">↗</span>
                  </Link>
                  <Link href="/signup" className="ldis-button ldis-button-secondary">
                    নতুন অ্যাকাউন্ট
                  </Link>
                </>
              )}
            </div>
            <p className="ldis-hero-note"><span aria-hidden="true">ⓘ</span> এটি রেফারেন্স ডেটা-ভিত্তিক পরীক্ষামূলক সহায়ক ব্যবস্থা।</p>
          </div>
        </div>
        <div className="ldis-hero-bottom-rule" aria-hidden="true" />
      </section>

      <section className="ldis-about" aria-labelledby="ldis-about-title">
        <div className="ldis-section-shell ldis-about-grid">
          <div className="ldis-about-heading ldis-reveal">
            <p className="ldis-eyebrow">আমাদের সম্পর্কে</p>
            <h2 id="ldis-about-title">ভূমি যাচাই থেকে <span>নিবন্ধনের প্রস্তুতি</span></h2>
            <span className="ldis-heading-rule" aria-hidden="true" />
          </div>
          <div className="ldis-about-copy ldis-reveal ldis-delay-1">
            <p>
              জমি-সম্পর্কিত গুরুত্বপূর্ণ তথ্য এক জায়গায় দেখে প্রাথমিক যাচাইয়ের কাজকে আরও গোছানো করাই এই প্রকল্পের উদ্দেশ্য। পরিচয়, খতিয়ান/পর্চা, আগের দলিল, ওয়ারিশের তথ্য, সরকারি স্বার্থের সংকেত এবং ই-চালান-সংক্রান্ত রেফারেন্স তথ্য মিলিয়ে দেখা যায়।
            </p>
            <p className="ldis-about-caveat">
              ফলাফল প্রকল্পের নিজস্ব রেফারেন্স ডেটার ওপর নির্ভরশীল—এটি সরকারি সেবা, আইনগত মালিকানা নিশ্চিতকরণ বা চূড়ান্ত নিবন্ধনের বিকল্প নয়।
            </p>
          </div>
        </div>
      </section>

      <section className="ldis-services" aria-labelledby="ldis-services-title">
        <div className="ldis-section-shell">
          <div className="ldis-section-heading ldis-reveal">
            <p className="ldis-eyebrow">সেবাসমূহ</p>
            <h2 id="ldis-services-title">যাচাইয়ের ক্ষেত্রসমূহ</h2>
            <p>প্রাসঙ্গিক রেফারেন্স তথ্য একত্রে পর্যালোচনা করার ছয়টি ক্ষেত্র</p>
          </div>
          <div className="ldis-service-grid">
            {services.map((service, index) => (
              <article
                className={`ldis-service-card ldis-reveal ldis-delay-${(index % 3) + 1}`}
                key={service.title}
              >
                <div className="ldis-service-icon"><ServiceIcon name={service.icon} /></div>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </div>
                <span className="ldis-service-index" aria-hidden="true">0{index + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ldis-disclaimer-wrap" aria-label="গুরুত্বপূর্ণ সতর্কতা">
        <div className="ldis-section-shell ldis-disclaimer ldis-reveal">
          <div className="ldis-disclaimer-mark" aria-hidden="true">!</div>
          <div className="ldis-disclaimer-content"><Disclaimer /></div>
        </div>
      </section>
    </div>
  );
}
