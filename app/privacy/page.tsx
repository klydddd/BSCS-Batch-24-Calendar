"use client";

import Link from "next/link";

export default function PrivacyPolicy() {
    return (
        <div className="hero-section">
            <div className="hero-bg" />

            {/* Background Title */}
            <div className="hero-title-container">
                <h1 className="hero-title">PRIVACY</h1>
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
                            Privacy Policy
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
                                1. Information We Collect
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                When you use BSCS Calendar, we may collect the following information:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Your Google account email address (for authentication)</li>
                                <li>Calendar event data that you choose to create through our service</li>
                                <li>Course schedule information you input into the application</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                2. How We Use Your Information
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                We use the collected information solely for:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Authenticating your identity through Google OAuth</li>
                                <li>Creating and managing calendar events on your behalf</li>
                                <li>Providing the core functionality of schedule automation</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                3. Data Storage and Security
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                We do not store your personal data on our servers. All calendar events are
                                created directly in your Google Calendar. Authentication tokens are handled
                                securely through Google&apos;s OAuth 2.0 protocol and are not permanently stored.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                4. Third-Party Services
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                This application uses Google Calendar API and Google OAuth for authentication.
                                Your use of these services is also subject to Google&apos;s Privacy Policy.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                5. Your Rights
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                You have the right to:
                            </p>
                            <ul style={{
                                marginTop: "0.5rem",
                                paddingLeft: "1.5rem",
                                color: "rgba(255, 255, 255, 0.75)"
                            }}>
                                <li>Revoke access to your Google account at any time through Google account settings</li>
                                <li>Delete any calendar events created through this application</li>
                                <li>Request information about how your data is processed</li>
                            </ul>
                        </section>

                        <section>
                            <h2 style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                marginBottom: "0.75rem",
                                color: "var(--white)"
                            }}>
                                6. Contact Us
                            </h2>
                            <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                                If you have any questions about this Privacy Policy, please contact us through
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
