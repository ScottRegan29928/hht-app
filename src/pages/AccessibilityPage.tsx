import { useSeo } from "@/lib/seo";

export default function AccessibilityPage() {
  useSeo({
    title: "Accessibility | Heritage Vacations",
    description: "Our approach to website accessibility and how to get help with Heritage Vacations rentals.",
    noindex: false,
  });
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-foreground">
      <header>
        <h1 className="text-3xl font-semibold mb-3">Website Accessibility</h1>
        <p>Heritage Vacations</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Our Commitment</h2>
        <p>We want everyone to be able to explore our vacation rentals and contact us. We work to make this website easier to use for people with disabilities.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Measures We Take</h2>
        <p>Our work includes improving form labels, text contrast, keyboard navigation, visible focus indicators, and links that let visitors skip to the main content.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Conformance Status</h2>
        <p>We use the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA as a guide for improvements. We have not established full conformance and do not claim that every part of this website meets those guidelines.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Known Limitations</h2>
        <p>The property map provides a visual way to explore communities; the community links and property search offer another way to browse. Automated testing does not establish whether every photograph description, reading order, or booking interaction works well with all assistive technology. Those areas need further review. Please contact us if you encounter a barrier.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Compatibility With Browsers and Assistive Technology</h2>
        <p>The website is intended for current versions of major browsers. We have not completed testing with screen readers such as NVDA or VoiceOver and cannot guarantee compatibility with every browser and assistive technology combination.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Technical Specifications</h2>
        <p>The website uses HTML, CSS, JavaScript, and ARIA. JavaScript is required for live availability, property search, and booking.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Assessment Approach</h2>
        <p>On November 13, 2026, an automated axe-core review of 100 public Heritage pages checked the WCAG 2 A, WCAG 2 AA, WCAG 2.1 A, and WCAG 2.1 AA rule sets. That review identified issues for correction; it was not a complete manual accessibility evaluation or a certification. No screen-reader testing is claimed.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Alternative Ways to Reach Us</h2>
        <p>For help finding a rental or making a reservation, call <a href="tel:8433635699" className="underline">843.363.5699</a> or choose Contact in the website navigation. Website accessibility does not establish a property's physical accessibility; please ask about your specific needs before booking.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Feedback</h2>
        <p>Please tell us the page address, what you were trying to do, and the barrier you encountered. If possible, include your browser and assistive technology so we can investigate and help you another way.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Ongoing Effort</h2>
        <p>Accessibility is an ongoing effort. We will use feedback and further testing to identify and prioritize improvements.</p>
      </section>
    </article>
  );
}
