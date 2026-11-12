# EVERNEED
## Cookies and Similar Tracking Technologies Notice

**Document type:** Internal cookie, local-storage, SDK and tracking transparency notice  
**Document status:** Working draft for founder, product, privacy and Nigerian legal review; not approved for publication  
**Business status:** Current internal records describe Everneed as a founder-led startup that is not yet registered with the Corporate Affairs Commission (CAC)  
**Initial market:** Nigeria  
**Project reference branch:** `web-portal`  
**Prepared:** November 2026

> **IMPORTANT — NOT READY FOR PUBLICATION.** This is a proposed notice and implementation framework, not legal advice and not evidence that Everneed currently uses any particular cookie, pixel, SDK, analytics provider, advertising technology or tracking method. The actual deployed website, Android application, WebView behaviour, hosting configuration, third-party scripts, cookies, local storage, device identifiers and consent controls must be inspected. Complete the inventory from real browser and device tests, obtain Nigerian privacy-law review, and ensure the consent interface behaves as described before publishing this notice.

---

## 1. Purpose

This notice explains how the Everneed digital commerce platform may use cookies and similar technologies on its website and application, why they may be used, how optional technologies should be controlled, and how users can manage their choices.

“Cookies and similar technologies” may include:

- Browser cookies, including session and persistent cookies.
- Local storage and session storage.
- Software development kits (SDKs) embedded in mobile applications.
- Device, advertising or analytics identifiers.
- Pixels, tags, scripts and software that record events or interactions.
- Technologies used to maintain sessions, protect accounts, remember preferences, measure performance or support marketing.

This notice must be read with the Everneed Privacy Notice and Customer Terms of Use. It should be published only after the actual technology inventory and consent behaviour have been verified.

## 2. Who is responsible?

**Platform / trading name:** Everneed  
**Legal operator / data controller:** [insert verified full legal name and legal form]  
**Registration number, if applicable:** [insert only after verification]  
**Business or registered address:** [insert verified address]  
**Privacy contact:** [insert monitored privacy email]  
**Customer support contact:** [insert monitored support contact]  
**Effective date:** [insert after approval]  
**Notice version:** [insert]

The name “Everneed” is a platform or trading name in this draft. It must not be presented as a separate incorporated company or legal controller until the correct legal person has been identified. A third-party technology provider may act as a processor or independent controller depending on the actual service and processing purposes.

## 3. What technologies may be used?

The table below describes possible categories, not a statement that each is currently deployed. The operator must complete the inventory in Schedule 1 and remove any category that is not actually used.

| Category | Typical purpose | Examples of functionality | Default treatment proposed |
|---|---|---|---|
| Strictly necessary | Provide a service expressly requested or essential to the platform's operation, security or communication | Login/session continuity, security controls, load balancing, checkout state, fraud/security protection | May operate where legally permitted and genuinely necessary; explain clearly |
| Preference | Remember choices that improve the experience | Language, display or accessibility preferences, saved non-essential settings | Optional unless strictly necessary for a requested feature |
| Analytics / performance | Understand aggregate or user-level use, diagnose errors and improve the platform | Page views, feature use, performance events, crash/error diagnostics | Off until the required lawful basis and consent, where required, are established |
| Advertising / marketing | Measure campaigns, build audiences or personalise promotional content | Ad pixels, retargeting identifiers, conversion tracking | Off by default unless and until valid permission and legal review support use |
| Embedded third-party content | Enable content or functions supplied by another service | Maps, videos, social widgets or external payment components | Load only when needed and after any required notice/permission; explain third-party terms |
| Mobile app SDKs | Provide app functions, diagnostics, attribution or analytics | Crash reporting, push notification tokens, device identifiers, attribution | Inventory each SDK and purpose; disable optional collection until appropriately authorised |

A technology is not automatically “strictly necessary” because it is convenient, improves analytics, supports advertising, or is supplied by a vendor. Classification must reflect its real purpose and whether the service can operate without it.

## 4. Why we may use these technologies

Subject to the actual deployment and applicable law, Everneed may use necessary technologies to:

- Keep a user signed in and protect account sessions.
- Maintain security, prevent abuse and detect suspicious activity.
- Remember choices that the user has specifically requested.
- Maintain shopping cart or checkout state where needed for the requested service.
- Operate core marketplace functions and maintain service availability.
- Understand errors and performance where a lawful basis and any required consent are in place.
- Measure marketing effectiveness or deliver personalised promotions only where the relevant processing is lawful and transparently disclosed.

The operator must document the purpose and legal basis for each technology. A cookie notice or banner does not, by itself, establish a lawful basis for every form of processing.

## 5. Consent and user choices

5.1 **Clear choice:** Where consent is required for a non-essential technology, the platform must obtain valid consent before placing or accessing it. The user must be able to accept or reject optional categories with comparable ease.

5.2 **No preselected optional categories:** Analytics, advertising and other non-essential categories must not be switched on by default where prior consent is required.

5.3 **Granular controls:** Where practical, users should be able to choose separate categories, such as preferences, analytics and advertising, rather than being forced to accept all optional technologies together.

5.4 **Reject as easy as accept:** The initial choice interface should provide a clear way to reject optional technologies, not hide rejection behind multiple screens or use misleading button labels.

5.5 **No consent wall for core commerce:** Refusing optional analytics or advertising should not block access to core marketplace features unless a specific technology is objectively necessary for a feature the user chooses to use and the legal basis has been assessed.

5.6 **Withdrawal:** Users must be able to change or withdraw optional consent at any time through a persistent “Cookie settings” or equivalent control. Withdrawal must stop future optional access or collection as soon as technically practicable. It does not invalidate processing that was lawful before withdrawal.

5.7 **Consent records:** Where consent is relied on, the platform should record the choice, categories, notice version, timestamp, relevant device or session reference and withdrawal/change history, using a proportionate and secure method.

5.8 **No dark patterns:** Do not use deceptive colours, confusing labels, repeated prompts designed to wear users down, false urgency or misleading claims that optional tracking is essential.

5.9 **Children:** Do not use advertising or behavioural tracking directed at children. If a service is likely to be used by children, obtain a specific legal and product assessment before enabling optional tracking or profiling.

## 6. How to manage cookies and similar technologies

### 6.1 Everneed preference controls

When implemented, users should be able to open **Cookie settings** from [insert verified website footer, privacy page or account settings location] and:

- Review the categories used.
- Accept or reject optional categories.
- Change a previous choice.
- Withdraw consent.
- Read the current notice version.

The settings interface must be tested on mobile and desktop, including small Android screens and supported browsers.

### 6.2 Browser controls

Most browsers allow users to view, delete or block cookies and clear site data. Blocking all cookies or local storage may affect sign-in, cart state, security or other core functions. Browser controls do not necessarily control identifiers or SDKs used by a mobile application.

### 6.3 Android application controls

The Android application may use SDKs, app storage, device identifiers or push-notification tokens that are not managed through a browser cookie panel. The operator must provide an in-app privacy or tracking settings route where optional SDK collection is enabled and user choice is required.

Users may also review app permissions and clear app data through Android settings. These device controls do not replace Everneed's obligation to obtain any required consent or provide appropriate privacy information.

## 7. Third-party services

Some technologies may be supplied by third parties. Before enabling any third-party script, SDK, pixel or embedded feature, Everneed must identify:

- The provider's correct legal entity and product.
- The exact technology loaded and its purpose.
- The information it collects or can access.
- Whether it sets or reads identifiers on the user's device.
- Whether it receives account, order, device, location or other identifiers.
- Whether the provider acts as a Processor or an independent Controller for each activity.
- The provider's privacy notice and applicable data-processing terms.
- Processing, hosting, support and remote-access locations.
- Any international transfer mechanism and onward recipients.
- Retention, deletion and user opt-out mechanisms.
- Whether prior consent is required and how the technology is blocked before consent.

The presence of a provider's library, package or configuration in source code does not prove that the technology is deployed, enabled, or receiving production data.

## 8. Website and application distinctions

### 8.1 Website

The operator must inspect all public pages, seller portal routes, account routes, checkout pages, admin pages and embedded content in the deployed website. The inventory should include first-party and third-party cookies, local storage, session storage, scripts, tags, pixels and network requests.

Test:
- First visit with no choice made.
- Accept all optional categories.
- Reject all optional categories.
- Select individual categories.
- Withdraw or change consent.
- Return after browser restart.
- Private/incognito browsing.
- Mobile browser and desktop browser.
- Logged-out and logged-in states.
- Checkout and payment redirects.
- External content and embedded services.

### 8.2 Android application

The operator must inspect the actual release build and all SDKs, including dependencies that may initialise automatically. Identify device identifiers, advertising identifiers, crash diagnostics, analytics events, push tokens, attribution and embedded browser/WebView behaviour.

Test:
- First install and first launch.
- No optional consent.
- Accepted and rejected choices.
- Consent change and withdrawal.
- Logged-in and logged-out use.
- Checkout and payment hand-off.
- Push notification permission separately from tracking consent.
- App reinstall, app data clearing and operating-system permission changes.
- Network traffic before and after each consent choice.

An Android permission prompt is not a substitute for privacy notice or consent where required. Push notification permission and permission for analytics or advertising are separate matters.

## 9. Data protection and security

Cookies and similar technologies may collect or reveal personal data, including identifiers, device information, browsing activity, account-linked events and location-related information. The operator must:

- Apply data minimisation and purpose limitation.
- Use secure transmission and appropriate storage protections.
- Restrict access to analytics and advertising dashboards.
- Avoid placing passwords, authentication secrets, payment credentials or unnecessary Personal Data in URLs, cookie values or analytics events.
- Set secure cookie attributes where applicable, including appropriate Secure, HttpOnly and SameSite settings.
- Use appropriate expiry and deletion settings.
- Prevent unauthorised third-party scripts from accessing sensitive account or checkout pages.
- Review SDK permissions and network behaviour.
- Maintain a record of technology changes and approvals.
- Reassess risks where tracking becomes account-linked, cross-site, location-based or profiling-related.

The exact controls must be matched to the deployed architecture and risk. This notice does not claim that any particular control is currently implemented.

## 10. Retention

Each technology must have a documented lifetime or retention rule. The operator must complete Schedule 1 with actual cookie and identifier names, providers, purpose, duration and storage type.

Do not use indefinite cookie or identifier lifetimes by default. Review retention when a purpose ends, consent is withdrawn, a provider changes its service, or a technology is removed.

Analytics and advertising providers may retain information under their own policies when they act as independent Controllers. The operator must explain this accurately and must not promise deletion from a third party's systems unless it has verified the provider's process and authority.

## 11. International transfers

If a cookie, SDK or third-party service transfers or permits access to Personal Data outside Nigeria, the operator must identify the destination and receiving entity and establish a lawful transfer condition and appropriate safeguards under the Nigeria Data Protection Act 2023 and applicable GAID requirements.

No international transfer is authorised merely because a vendor is widely used or because its servers are described as cloud infrastructure. Verify hosting, backup, support and remote-access locations and document the transfer assessment.

## 12. Updates to this notice

This notice may be updated when the technologies, purposes, legal requirements or platform features change. Material changes should be explained clearly and, where required, users should be asked to make a fresh choice before new optional technologies are activated.

The notice must display its effective date and version. Keep prior versions and consent records for appropriate governance and audit purposes.

## 13. Contact and complaints

For questions or requests relating to cookies, SDKs or tracking:

**Privacy contact:** [insert monitored privacy email]  
**Postal address:** [insert verified address]  
**Customer support:** [insert monitored support contact]  
**Data Protection Officer / privacy lead:** [insert only after appointment and applicability assessment]

Users may also have rights or complaint routes under applicable Nigerian data-protection law. The operator must provide accurate regulator information in the final published notice and must not imply that contacting Everneed removes any statutory right to contact the regulator.

---

# SCHEDULE 1 — LIVE COOKIE, STORAGE AND SDK INVENTORY

**Environment inspected:** [production / staging / development]  
**Domain / app package and version:** [insert]  
**Inspection date:** [insert]  
**Inspector:** [insert]  
**Browser/device matrix:** [insert]  
**Consent interface version:** [insert]

Complete one row for every cookie, local-storage key, SDK, pixel, tag, identifier or similar technology. Include technologies that load automatically before a user makes a choice.

| Name / identifier | Provider / owner | Technology type | Purpose | Data collected / accessed | Category | First / third party | Duration | Country / access location | Consent required? | Blocked before choice? | Evidence / notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [insert actual name] | [verified provider] | [cookie / SDK / local storage / pixel] | [specific purpose] | [specific fields] | [necessary / preference / analytics / advertising / other] | [first / third] | [actual lifetime] | [verified] | [legal assessment] | [yes / no / n/a] | [test evidence] |

**Do not populate this table from memory, package names alone or generic vendor documentation. Inspect actual runtime behaviour and network requests.**

### Required evidence

- [ ] Browser cookie and storage export from a clean first visit.
- [ ] Network request capture before any consent choice.
- [ ] Network request capture after accepting optional categories.
- [ ] Network request capture after rejecting optional categories.
- [ ] Test showing consent withdrawal stops optional technologies.
- [ ] Android dependency and SDK inventory for the release build.
- [ ] Android runtime/network inspection before and after consent.
- [ ] Provider contracts and privacy notices.
- [ ] Data-flow and international-transfer assessment.
- [ ] Retention and deletion verification.
- [ ] Screenshots and test records for all consent states.

---

# SCHEDULE 2 — CONSENT AND PREFERENCE DESIGN

Complete and approve before release.

| Requirement | Approved design / implementation reference | Verified? |
|---|---|---|
| First-layer notice explains purposes | [insert] | [yes / no] |
| Accept optional technologies | [insert] | [yes / no] |
| Reject optional technologies | [insert] | [yes / no] |
| Granular category selection | [insert] | [yes / no] |
| No optional category preselected | [insert] | [yes / no] |
| Optional scripts/SDKs blocked before required consent | [insert] | [yes / no] |
| Persistent preference/settings access | [insert] | [yes / no] |
| Withdrawal/change of consent | [insert] | [yes / no] |
| Consent version and timestamp record | [insert] | [yes / no] |
| Mobile accessibility and clear language | [insert] | [yes / no] |
| Keyboard/screen-reader accessibility | [insert] | [yes / no] |
| No dark patterns or forced consent | [insert] | [yes / no] |
| Consent behaviour tested on release build | [insert] | [yes / no] |

---

## 14. Everneed-specific implementation checklist

Before publishing this notice or activating optional tracking:

### Inventory and role assessment
- [ ] Inspect the deployed website and Android release build, not only source files.
- [ ] Inventory cookies, local/session storage, WebView storage, scripts, pixels, SDKs, device identifiers and network requests.
- [ ] Identify the exact purpose and data fields for each technology.
- [ ] Determine which technologies are genuinely necessary and which are optional.
- [ ] Identify provider legal entities, controller/processor roles, data locations, retention and onward recipients.
- [ ] Review international transfers and document the applicable lawful mechanism.
- [ ] Reconcile this notice with the Privacy Notice and Data Processing Agreement Template.

### Consent and user experience
- [ ] Obtain Nigerian privacy-law advice on the consent and lawful-basis requirements for each technology.
- [ ] Build a clear first-layer choice interface where required.
- [ ] Provide accept, reject and granular options with comparable ease.
- [ ] Ensure optional technologies do not load before required consent.
- [ ] Provide a persistent way to revisit and withdraw choices.
- [ ] Record consent in a proportionate, secure and auditable manner.
- [ ] Test mobile accessibility, older Android devices, low-bandwidth use and WebView behaviour.
- [ ] Ensure rejecting optional tracking does not unnecessarily block core marketplace access.

### Technical verification
- [ ] Check third-party scripts and SDKs for automatic initialisation.
- [ ] Inspect whether identifiers or events are sent before consent.
- [ ] Ensure authentication secrets, card data and sensitive information are not sent to analytics or advertising tools.
- [ ] Review cookie security attributes, expiry and scope.
- [ ] Test consent persistence, withdrawal and provider opt-out behaviour.
- [ ] Remove unused tags, libraries and SDKs.
- [ ] Establish change control so a new vendor or SDK cannot be added without privacy review.

### Approval and publication
- [ ] Complete Schedule 1 from runtime evidence.
- [ ] Complete Schedule 2 and retain test evidence.
- [ ] Verify all contact and legal-entity details.
- [ ] Confirm the notice accurately describes the current production service.
- [ ] Obtain founder and qualified Nigerian privacy counsel approval.
- [ ] Publish the approved version and retain prior versions.
- [ ] Reassess after every material website, app, SDK, vendor or legal change.

## 15. Regulatory reference points

Review the current official materials and obtain advice on their application:

- Nigeria Data Protection Commission: https://ndpc.gov.ng/
- Nigeria Data Protection Act / General Application and Implementation Directive 2025 official publication: https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf
- NDPC DCPMI guidance material: https://ndpc.gov.ng/wp-content/uploads/2026/01/NDP-ACT-GAID-2025-MARCH-20-1.pdf

Verify that these are still the current official publications before relying on them. This notice is a practical transparency and implementation framework; it does not determine whether any specific cookie, SDK or tracking activity is lawful without a factual assessment.

---

**Document owner:** Founder / designated privacy lead  
**Approval status:** Draft — not approved for publication  
**Next review:** [insert date or material-change trigger]  
**Related documents:**
- `docs/LEGAL/PRIVACY_NOTICE.md`
- `docs/LEGAL/DATA_PROCESSING_AGREEMENT_TEMPLATE.md`
- `docs/LEGAL/LEGAL_COMPLIANCE_PLAN.md`
- `docs/LEGAL/CUSTOMER_TERMS_OF_USE.md`
- `docs/PRODUCT/PRODUCT_STATUS.md`
