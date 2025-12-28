"use client";

import Link from "next/link";

export default function TermsOfService() {
    return (
        <div className="hero-section">
            <div className="hero-bg" />

            {/* Background Title */}
            <div className="hero-title-container">
                <h1 className="hero-title">TERMS</h1>
            </div>

            {/* Main Content */}
            <div className="glass-container" style={{ maxWidth: "800px", padding: "2rem" }}>
                <div className="glass-panel" style={{ padding: "2.5rem" }}>
                    {/* Header */}
                    <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                        <h1 style={{
                            fontSize: "1.75rem",
                            fontWeight: 800,
                            color: "var(--white)",
                            marginBottom: "0.5rem"
                        }}>
                            Terms of Service
                        </h1>
                        <p style={{
                            fontSize: "0.875rem",
                            color: "rgba(255, 255, 255, 0.6)"
                        }}>
                            Last updated: December 28, 2025
                        </p>
                    </div>

                    {/* Content */}
                    <div style={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontSize: "0.9rem",
                        lineHeight: 1.7,
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.5rem"
                    }}>
                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                1. Acceptance of Terms
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                By accessing and using BSCS Calendar (&quot;the Service&quot;), you agree to be bound
                                by these Terms of Service. If you do not agree to these terms, please do not
                                use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                2. Description of Service
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                BSCS Calendar is a calendar automation tool designed specifically for but not limited to BSCS
                                Batch 2028 students. The Service allows users to:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Input and manage course schedules</li>
                                <li>Automatically create Google Calendar events</li>
                                <li>Export schedule data in various formats</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                3. Google Account Authorization
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                To use the calendar integration features, you must authorize our application
                                to access your Google Calendar. By doing so, you grant us permission to
                                create, modify, and manage calendar events on your behalf. You may revoke
                                this access at any time through your Google account settings.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                4. User Responsibilities
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                You are responsible for:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Providing accurate schedule information</li>
                                <li>Maintaining the security of your Google account</li>
                                <li>Reviewing calendar events before they are created</li>
                                <li>Using the Service in compliance with applicable laws</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                5. Limitation of Liability
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                The Service is provided &quot;as is&quot; without warranties of any kind. We are
                                not liable for any damages resulting from:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Incorrect or missed calendar events</li>
                                <li>Service interruptions or downtime</li>
                                <li>Loss of data or schedule information</li>
                                <li>Any issues arising from Google Calendar API limitations</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                6. Intellectual Property
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                All content, design, and code associated with BSCS Calendar are protected
                                by intellectual property rights. You may not copy, modify, or distribute
                                any part of the Service without explicit permission.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                7. Modifications to Terms
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                We reserve the right to modify these Terms of Service at any time.
                                Continued use of the Service after changes constitutes acceptance of
                                the modified terms.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                8. Contact Information
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                For questions regarding these Terms of Service, please contact us through
                                our official channels.
                            </p>
                        </section>
                    </div>

                    {/* Back Button */}
                    <div style={{ marginTop: "2.5rem", textAlign: "center" }}>
                        <Link href="/" className="btn-glass">
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
