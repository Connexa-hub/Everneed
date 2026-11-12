# EVERNEED
## Seller Onboarding & Marketplace Participation Policy

**Document type:** Internal seller-facing policy — working draft for founder and Nigerian legal review  
**Document status:** Draft only; not approved for publication or use as a live onboarding promise  
**Business status:** Founder-led startup; current internal records state that Everneed is not yet registered with the Corporate Affairs Commission (CAC)  
**Initial market:** Nigeria  
**Project reference branch:** `web-portal`  
**Prepared:** November 2026

> **IMPORTANT — NOT READY FOR PUBLICATION.** This policy describes the intended seller onboarding and participation framework. It does not establish that applications are currently open, that any seller has been approved, that verification checks are operational, or that a hub, delivery network, payment settlement or seller-support service is live. The current web portal contains a five-step seller application flow, but code does not prove that every field, review action, permission or backend control works in production. Complete the placeholders, confirm actual workflows and obtain Nigerian legal review before publication.

---

## 1. Purpose and guiding principle

Everneed is being built as **A Digital Commerce Ecosystem**: a platform intended to connect independent businesses with customers and support commerce through digital storefronts and related services.

This policy explains how a business may apply to become an Everneed seller, what information may be requested, how an application may be assessed, what an approved seller is expected to do and how a seller can challenge a decision.

The guiding principle is:

**Make it easy for genuine businesses to participate, ask only for information that is reasonably necessary, explain every requirement, and treat sellers fairly.**

Everneed should not make onboarding unnecessarily expensive or complicated for small and emerging businesses. Verification must be proportionate to the seller's activity, product risk, payment requirements and applicable law.

## 2. Who may apply?

Subject to applicable law and the categories the Platform supports, applications may be considered from:

- Individuals operating a genuine business or trade.
- Sole proprietors and small businesses.
- Registered business names and companies.
- Manufacturers, retailers, wholesalers, distributors and other eligible merchants.
- Local businesses with products they are authorised to sell.
- Other legitimate suppliers approved for the relevant marketplace category.

An application is not a guarantee of approval. Everneed may limit onboarding by category, location, operational capacity, product safety requirements or pilot availability.

### 2.1 Applicants who cannot independently contract

An applicant must have legal capacity to enter into the seller agreement. A person who cannot independently enter into the relevant agreement must not be onboarded as the contracting seller without the legally required parent, guardian or authorised representative arrangement. The exact age and capacity checks must be approved by Nigerian counsel.

### 2.2 Who cannot be accepted

Everneed must not knowingly onboard a person or business for unlawful activity, impersonation, fraud, sale of prohibited goods, infringement of third-party rights or other conduct that creates unacceptable legal, safety or marketplace risk.

## 3. Application journey

The seller portal reviewed on the `web-portal` branch contains a five-step store application structure. The intended application journey is:

1. **Store identity:** proposed store name, description, tagline, logo or cover details where requested.
2. **Business and location:** seller type, business contact information, category and relevant operating location.
3. **Delivery preferences:** how the seller proposes to prepare, hand over or deliver orders, subject to available services.
4. **Payout information:** information needed to configure a lawful payment and settlement route, collected only when necessary and through an appropriately protected process.
5. **Business confirmation:** confirmation that the applicant is authorised to operate the store, provide accurate information and comply with marketplace rules.

The exact fields, mandatory status and evidence requirements must be reviewed against the live application before this description is shown to applicants. Do not ask for a document or personal identifier simply because a field exists in a draft form.

## 4. Information and verification

Everneed may request information reasonably necessary to establish the applicant's identity, authority, business activity, contactability, product eligibility, payment arrangements and legal compliance.

Depending on the seller type and risk, this may include:

| Information category | Possible examples | Onboarding principle |
|---|---|---|
| Applicant identity | Full name, contact details and a suitable identity-verification reference or document where required | Request only what is necessary and provide a secure submission route |
| Business identity | Trading name, legal form, registration details if registered, business address or operating location | Do not require CAC registration from every informal or small seller unless law, risk or a specific service requires it |
| Authority to act | Evidence that an applicant may act for the business, where relevant | Request proportionate proof for representatives and organisations |
| Store profile | Store name, description, category, logo and cover image | Ensure the applicant has rights to use submitted content |
| Product eligibility | Product category, source or authorisation information, safety or compliance documents where applicable | Apply category-specific checks; do not demand irrelevant certificates |
| Fulfilment information | Pickup area, preparation capability and direct-delivery preference | Do not imply that a hub or courier service is available until confirmed |
| Payment and settlement | Account or provider information required by the selected licensed payment provider | Use the provider's approved process; do not collect PINs, passwords or full card credentials |
| Tax or regulatory information | Tax or sector-specific details where required by law or the seller's activity | Obtain professional advice and explain why the information is required |

### 4.1 Proportionate verification

Verification should be risk-based. For example:

- A low-risk seller listing ordinary general merchandise may need a lighter initial review than a seller offering regulated, safety-critical or high-value products.
- A seller whose activity requires a licence, registration or professional authorisation must provide the relevant evidence before listing or selling those products.
- Additional checks may be necessary where information is inconsistent, fraud indicators arise, a payment provider requires verification or the law imposes a duty.

Everneed must explain any additional request and why it is needed. Where a less intrusive method can reasonably achieve the same objective, prefer it.

### 4.2 Data protection

Seller application information must be processed under the Everneed Privacy Notice and applicable data-protection law. Access must be limited to authorised reviewers and service providers with a legitimate need.

Do not request or accept identity documents through public comments, open social-media posts or unsecured group chats. Do not place identity documents, bank credentials, passwords or payment secrets in ordinary product descriptions or support messages.

## 5. Application review and decisions

An application may be reviewed for:

- Completeness and consistency.
- Identity and authority to operate the proposed store.
- Genuine business activity and contactability.
- Product category and legal eligibility.
- Listing quality and accurate descriptions.
- Ability to fulfil orders using an available route.
- Payment-provider requirements.
- Fraud, safety, intellectual-property or other material risk.
- Compliance with the Seller Marketplace Agreement and relevant policies.

Possible application states may include:

| Status | Meaning |
|---|---|
| Draft | The applicant has started but not submitted the application |
| Submitted / under review | The application has been received and awaits assessment |
| More information required | The reviewer needs clarification or specific evidence |
| Approved | The store is approved for the scope stated in the decision |
| Rejected | The application was not accepted, with a reason where it is safe and lawful to provide one |
| Suspended | An approved store's activity has been temporarily restricted |
| Closed | The seller relationship has ended |

These are policy definitions. The exact status names and transitions must match the production implementation before being described as available.

### 5.1 Review time

**Target review period:** [insert a realistic service target after staffing and workflow testing]  
**Seller application support:** [insert monitored channel]

Everneed must not advertise a review time it cannot consistently meet. If a review is delayed or additional information is needed, the applicant should receive an update where practical.

### 5.2 Approval scope

Approval applies only to the seller, store and product categories expressly approved. It does not automatically authorise regulated goods, every product submitted, every delivery area or any payment service not separately enabled.

A product may require its own review after store approval.

## 6. Reasons an application may be declined or paused

An application may be declined, returned for correction or paused where:

- Required information is missing and cannot reasonably be verified.
- The applicant cannot demonstrate authority to operate the proposed store.
- Information appears materially false, misleading or impersonated.
- The proposed products are prohibited, restricted without required authorisation or otherwise unsuitable for the Platform.
- The seller cannot meet an applicable legal or safety requirement.
- The applicant refuses a verification step that is genuinely required by law, a payment provider or a proportionate risk control.
- There is credible evidence of fraud, counterfeiting, unlawful conduct or serious consumer harm.
- The Platform cannot safely or lawfully support the proposed activity or location.
- The application otherwise materially breaches the seller agreement or published marketplace rules.

A rejection must not be arbitrary or discriminatory. Where practical and lawful, explain the issue and give the applicant an opportunity to correct an incomplete or mistaken submission.

Everneed may temporarily pause an application to investigate a credible safety, fraud, legal or security concern. Any restriction should be proportionate and reviewed.

## 7. Store setup and product listings

An approved seller is responsible for ensuring that its store and listings are accurate, current and lawful.

A seller must:

- Use a store name and branding it is entitled to use.
- Provide accurate descriptions, images, specifications, condition and product options.
- Set prices and stock information accurately.
- Identify the correct manufacturer, brand or source where required.
- Avoid fake, counterfeit, stolen, unsafe, recalled, prohibited or misleading products.
- Hold any licence, authorisation or evidence required for its products.
- Update or remove unavailable, discontinued or non-compliant listings promptly.
- Honour confirmed orders and the customer-facing terms applicable to the transaction.
- Respond to reasonable requests about product authenticity, safety, complaints or fulfilment.

Everneed may review, return, hide, reject or remove a listing where necessary for quality, legal compliance, safety, customer protection or marketplace integrity. The review process should provide a reason and correction route where safe and appropriate.

## 8. Seller responsibilities after approval

An approved seller is expected to:

1. Keep account, store, business and contact details accurate.
2. Maintain control of login credentials and promptly report suspected account compromise.
3. Keep product availability, prices, descriptions and options current.
4. Accept or decline orders promptly within the service expectations eventually published by Everneed.
5. Prepare the correct item and quantity, using suitable packaging.
6. Follow the agreed handover or delivery route for each order.
7. Keep proof of dispatch or handover where the process requires it.
8. Communicate honestly about delays, stock problems and order exceptions.
9. Cooperate with lawful customer complaints, returns, refunds and investigations.
10. Respect customer privacy and use customer information only for the relevant transaction and lawful obligations.
11. Avoid harassment, discrimination, misleading claims, fake reviews, manipulation or off-platform conduct that abuses Platform data.
12. Comply with the Seller Marketplace Agreement and all applicable marketplace policies and laws.

A seller remains responsible for obligations imposed on it as the supplier of its products. Everneed remains responsible for its own platform representations and services.

## 9. Delivery and fulfilment choices

Everneed's intended model may support different routes depending on the order and the services actually available.

### 9.1 Seller-direct delivery

A seller may deliver directly where the route is available, suitable and agreed for the order. The seller must communicate accurate delivery expectations and provide the required dispatch and delivery evidence.

### 9.2 Hub-assisted fulfilment

For eligible multi-seller orders, Everneed intends to support a model in which separate seller packages may be delivered to a designated hub, recorded, checked, consolidated and dispatched together where safe and practical.

A seller must use this route only when it is explicitly enabled for the relevant order and service area. The seller must follow package labelling, preparation, handover and custody requirements.

### 9.3 No compulsory route or undisclosed fee

A seller must not be charged for a hub, courier or other service it did not use. A seller must not be forced into an unavailable or unsuitable route. Any fee, responsibility transfer, insurance condition or service limitation must be disclosed before the seller accepts the relevant arrangement.

The hub-supported model is planned. This policy does not represent that a physical hub, fleet, rider network, collection point or nationwide delivery service is currently operational.

## 10. Fees, commissions and seller earnings

The commercial schedule must be disclosed before a seller accepts binding terms.

Everneed's recommended initial fairness principles are:

- Basic application and store participation should remain accessible.
- No compulsory joining fee or paid subscription should be introduced merely to access the basic marketplace.
- Optional subscriptions, promotions or advertising must be clearly described and genuinely optional.
- Any commission must state its rate, calculation base, qualifying event, deductions and treatment of cancellations and refunds.
- A delivery or hub charge may be applied only where the service is actually provided or coordinated and the charge is disclosed.
- Sellers must not be charged for a service they did not use.
- No arbitrary or unexplained seller-balance deductions.
- Seller proceeds, platform earnings, delivery collections, carrier costs and refunds must be accounted for separately.
- Settlement timing, any lawful reserve or hold, and a dispute process must be explained in advance.

**Important:** These are proposed commercial principles for founder approval, not a final price list or proof that every fee policy has been adopted. No commission rate, subscription price, payout schedule or hub tariff is set by this document.

## 11. Customer data and privacy duties

A seller may receive limited customer information needed to fulfil a particular order or handle a related issue.

The seller must:

- Use customer information only for the relevant order, delivery, support or lawful recordkeeping.
- Restrict access to authorised personnel.
- Keep customer information secure.
- Not sell, rent, scrape, profile or use it for unrelated marketing.
- Not add customers to marketing lists without a separate lawful basis and any required consent.
- Not share it with an unauthorised person or another seller.
- Report suspected loss, unauthorised access or disclosure promptly through [insert incident channel].
- Assist with lawful data-subject requests and incident investigations.
- Delete or securely dispose of information when it is no longer required, subject to applicable legal retention duties.

The actual legal roles of Everneed and each seller must be assessed for each processing activity. The Privacy Notice and Seller Marketplace Agreement should be read together with this policy.

## 12. Seller support, complaints and appeals

Seller support channel: **[insert monitored email, portal route or phone]**  
Application appeal channel: **[insert monitored channel]**  
Target acknowledgement time: **[set after operational testing]**

A seller may ask for a review of:
- An application rejection.
- A request for additional verification.
- A product or listing rejection.
- A store restriction or suspension.
- A disputed order adjustment or seller-balance deduction.
- A fulfilment or custody decision.
- Another material decision affecting seller participation.

Where practicable, the appeal should be reviewed by someone who did not make the original decision. The reviewer should consider the available evidence, applicable agreement and policy, and provide a reasoned outcome.

Everneed may restrict access immediately where necessary to prevent serious harm, protect users, respond to a credible fraud or security incident, preserve evidence or comply with law. The restriction should be reviewed as soon as reasonably practicable, with an explanation where safe and lawful.

## 13. Suspension, reinstatement and termination

A seller account or listing may be restricted where there is a material breach, unlawful product, safety concern, fraud, account compromise, repeated fulfilment failure, misuse of customer data, non-cooperation with a lawful investigation or other serious marketplace risk.

Everneed should use proportionate action, which may include:
- A request to correct information.
- A listing-level restriction.
- A temporary pause on new orders.
- Additional verification.
- A temporary store suspension.
- Termination for serious or repeated breaches.

Where practical, ordinary correctable issues should receive notice and an opportunity to respond. Immediate action may be justified for urgent safety, legal, fraud or security risks.

On closure, the parties must address open orders, customer remedies, seller funds, refunds, outstanding liabilities, access removal, data return/deletion and records that must lawfully be retained. Termination does not remove accrued rights or statutory obligations.

## 14. Fair treatment and prohibited conduct

Everneed must not use onboarding or enforcement to impose hidden or arbitrary burdens on sellers.

The following practices are not permitted under the intended marketplace compact:

- Charging a seller for applying or being reviewed without a clearly approved and lawful commercial basis.
- Making a paid subscription compulsory for basic marketplace participation without a transparent, founder-approved change to the model.
- Requiring sellers to buy advertising to obtain ordinary access to the marketplace.
- Applying undisclosed commission or retroactive fees.
- Charging commission on cancelled, unpaid or reversed transactions where no qualifying sale occurred.
- Forcing a seller to discount products or participate in promotions.
- Deducting money without a contractual basis, transaction record and explanation.
- Holding seller funds indefinitely or without a documented lawful reason.
- Penalising a seller for a platform, hub or carrier failure the seller did not cause.
- Rejecting an applicant through arbitrary or discriminatory treatment.
- Requiring unnecessary personal or business documents unrelated to the seller's activity or legal duties.

If Everneed changes its commercial terms, it must provide advance notice where required, explain the change and obtain renewed acceptance where legally necessary.

## 15. Changes to this policy

Everneed may update this policy as the Platform, legal requirements, seller services or fulfilment model changes.

A material change should be communicated through an appropriate channel. Where a change affects contractual rights, fees, data processing or seller obligations, Everneed must follow the Seller Marketplace Agreement and applicable law, including any required notice or acceptance.

The published version should carry a version number and effective date. Previous versions and seller acceptance records should be retained where legally necessary.

---

## 16. Internal onboarding and launch checklist

### A. Legal identity and contract
- [ ] Confirm the correct legal contracting party and legal capacity before binding seller agreements are issued.
- [ ] Complete legal-entity, address, registration and contact details.
- [ ] Obtain Nigerian legal review of the Seller Marketplace Agreement and this policy.
- [ ] Define the relationship between Everneed, the seller, payment provider, hub and courier for each service.
- [ ] Ensure the seller agreement and checkout terms are consistent.

### B. Application experience
- [ ] Verify each of the five application steps in the deployed portal.
- [ ] Confirm required versus optional fields and explain why each item is collected.
- [ ] Test draft, submission, more-information, approval, rejection, suspension and appeal states.
- [ ] Provide secure document upload and restrict access to verification records.
- [ ] Ensure applicants can correct mistakes and receive meaningful status updates.
- [ ] Test accessibility on low- and mid-range Android devices and mobile data.

### C. Verification and product risk
- [ ] Approve a proportionate verification matrix by seller type and product category.
- [ ] Identify restricted products and required licences or safety documents.
- [ ] Establish a process for authenticity, IP and safety complaints.
- [ ] Define re-verification triggers and how expired or changed documents are handled.
- [ ] Do not collect more identity data than necessary.

### D. Seller economics and fulfilment
- [ ] Approve and disclose the commission and fee schedule, if any.
- [ ] Define qualifying completed sale, refund reversals, seller statements and payout timing.
- [ ] Test seller ledger separation and prevent unauthorised deductions.
- [ ] Confirm which delivery routes and hub services are genuinely available.
- [ ] Document package handover, custody, failed delivery and return responsibilities.
- [ ] Ensure optional services remain optional and are not charged when unused.

### E. Privacy, security and support
- [ ] Align seller application collection with the Privacy Notice and retention schedule.
- [ ] Test seller-to-seller data isolation and role permissions.
- [ ] Define seller support, appeals, complaints and incident-reporting channels.
- [ ] Train reviewers on consistency, confidentiality and fair decision-making.
- [ ] Keep an audit record of material approval, rejection, suspension and financial decisions.

### F. Controlled pilot
- [ ] Start with a defined seller cohort, product categories and service boundary.
- [ ] Test the full path from application through listing, order, fulfilment, complaint and settlement.
- [ ] Measure application completion, review quality, seller activation, listing accuracy, fulfilment and seller satisfaction.
- [ ] Fix material security, legal, financial or operational gaps before widening onboarding.
- [ ] Review the policy after the pilot and whenever the model changes.

---

## 17. Related Everneed documents

- `docs/COMPANY/COMPANY_PROFILE.md`
- `docs/COMPANY/BUSINESS_MODEL.md`
- `docs/PRODUCT/PRODUCT_OVERVIEW.md`
- `docs/PRODUCT/PRODUCT_STATUS.md`
- `docs/OPERATIONS/OPERATIONS_PLAYBOOK.md`
- `docs/LEGAL/LEGAL_COMPLIANCE_PLAN.md`
- `docs/LEGAL/SELLER_MARKETPLACE_AGREEMENT.md`
- `docs/LEGAL/CUSTOMER_TERMS_OF_USE.md`
- `docs/LEGAL/PRIVACY_NOTICE.md`
- `docs/LEGAL/RETURNS_AND_REFUNDS_POLICY.md`

## 18. Regulatory references

The following official sources should be checked in their current form by qualified Nigerian counsel before approval:

- Corporate Affairs Commission: https://cac.gov.ng/
- Federal Competition and Consumer Protection Commission: https://fccpc.gov.ng/
- Nigeria Data Protection Commission: https://ndpc.gov.ng/
- Standards Organisation of Nigeria: https://son.gov.ng/
- National Agency for Food and Drug Administration and Control: https://nafdac.gov.ng/

The relevance of each regulator depends on the seller's legal form, product category and activity. Listing a regulator here does not imply that every seller needs every registration or that Everneed has obtained any approval.

**Document owner:** Founder / designated Marketplace Operations owner  
**Approval status:** Pending founder approval, Nigerian legal review and operational validation  
**Publication status:** Internal working draft — do not publish until all launch gates are complete
