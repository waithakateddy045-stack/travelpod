import './CopyrightPage.css';

export default function CopyrightPage() {
    return (
        <div className="copyright-page">
            <div className="copyright-container">
                <h1>Copyright Information</h1>
                <p className="copyright-updated">Last updated: March 2026</p>

                <section>
                    <h2>Your Content, Your Rights</h2>
                    <p>When you share content on Travelpod, you keep full ownership of everything you create. We simply need permission to display it on our platform so other travelers can enjoy it.</p>
                </section>

                <section>
                    <h2>Respecting Others' Work</h2>
                    <p>We believe in giving credit where it's due. If you share content, please make sure it's yours or you have permission to use it. This includes videos, photos, music, and written content.</p>
                </section>

                <section>
                    <h2>If You See Something</h2>
                    <p>If you come across content that you believe uses your work without permission, you can report it directly using the report button on any post. Select "Copyright concern" as the reason, and our team will review it promptly.</p>
                </section>

                <section>
                    <h2>What Happens Next</h2>
                    <p>Our team reviews every copyright report carefully. If we determine that content should be removed, we'll take it down and let the uploader know. We handle this process gently and fairly for everyone involved.</p>
                </section>

                <section>
                    <h2>Questions?</h2>
                    <p>If you have any questions about copyright on Travelpod, feel free to reach out to us at <a href="mailto:support@travelpod.app">support@travelpod.app</a></p>
                </section>

                <div className="copyright-footer">
                    <p>© 2026 Travelpod. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
