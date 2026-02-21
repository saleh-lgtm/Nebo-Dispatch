import Image from "next/image";
import Link from "next/link";
import { Clock, Users, Calendar, FileText, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero Section */}
      <header style={{
        padding: "1.5rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Image src="/logo.png" alt="Nebo Dispatch" width={40} height={40} />
          <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 600 }}>
            Nebo Dispatch
          </span>
        </div>
        <Link
          href="/login"
          className="btn btn-primary"
          style={{ padding: "0.6rem 1.5rem" }}
        >
          Sign In
        </Link>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section style={{
          padding: "4rem 2rem 6rem",
          textAlign: "center",
          maxWidth: "800px",
          margin: "0 auto"
        }}>
          <h1 style={{
            fontFamily: "Outfit, sans-serif",
            fontSize: "3rem",
            fontWeight: 700,
            marginBottom: "1.5rem",
            lineHeight: 1.2
          }}>
            Streamline Your <span style={{ color: "var(--accent)" }}>Dispatch Operations</span>
          </h1>
          <p style={{
            fontSize: "1.25rem",
            color: "var(--text-secondary)",
            marginBottom: "2.5rem",
            lineHeight: 1.6
          }}>
            Manage shifts, track reports, coordinate schedules, and handle affiliates —
            all in one powerful platform built for dispatch teams.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>
              Get Started
            </Link>
            <Link href="/login" className="btn btn-outline" style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>
              View Dashboard
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section style={{
          padding: "4rem 2rem",
          maxWidth: "1100px",
          margin: "0 auto"
        }}>
          <h2 style={{
            textAlign: "center",
            fontFamily: "Outfit, sans-serif",
            fontSize: "2rem",
            marginBottom: "3rem"
          }}>
            Everything You Need
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem"
          }}>
            <FeatureCard
              icon={<Clock size={28} />}
              title="Shift Tracking"
              description="Clock in/out with ease. Track hours worked and manage shift handoffs seamlessly."
            />
            <FeatureCard
              icon={<FileText size={28} />}
              title="Shift Reports"
              description="Document calls, reservations, incidents, and handoff notes in detailed reports."
            />
            <FeatureCard
              icon={<Calendar size={28} />}
              title="Scheduling"
              description="View and manage dispatcher schedules. Request changes with built-in approval flow."
            />
            <FeatureCard
              icon={<Users size={28} />}
              title="Affiliate Management"
              description="Track affiliate partners, rates, and approvals all in one place."
            />
            <FeatureCard
              icon={<Shield size={28} />}
              title="Role-Based Access"
              description="Admins and dispatchers get tailored views and permissions."
            />
            <FeatureCard
              icon={<Zap size={28} />}
              title="Real-Time Updates"
              description="Changes sync instantly across your team for smooth coordination."
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "2rem",
        textAlign: "center",
        borderTop: "1px solid var(--border)",
        color: "var(--text-secondary)",
        fontSize: "0.9rem"
      }}>
        <p>&copy; {new Date().getFullYear()} Nebo Dispatch. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-card" style={{
      display: "flex",
      flexDirection: "column",
      gap: "1rem"
    }}>
      <div style={{ color: "var(--accent)" }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: "Outfit, sans-serif",
        fontSize: "1.25rem",
        fontWeight: 600
      }}>
        {title}
      </h3>
      <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}
