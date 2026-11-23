# AeroSwift Global

Premium, multi-page logistics website for package shipping, air freight, international cargo coordination, shipment tracking and flight enquiries.

## Stack

- React 18 + Vite
- React Router
- Framer Motion
- Lucide icons
- Vercel serverless Node.js API routes
- Karrio multi-carrier shipping API for carrier tracking
- Resend for enquiry delivery

## Main journeys

- Homepage: premium AeroSwift brand and logistics overview
- Ship a package: parcel, box, business shipment and cargo quote enquiry
- Services: logistics service overview
- Air freight: air cargo and freight enquiry
- Shipment tracking: carrier-connected parcel and air-waybill lookup, carrier scan timeline and last carrier-reported map location
- Flight services: flight enquiry (not a live inventory or ticketing engine)
- About, contact and customer portal information

## Local development

```bash
npm install
npm run dev
```

## Shipment tracking integration

The website calls the server-side `POST /api/track` function. The Karrio API key is never exposed to the browser.

Set these environment variables in Vercel (and locally in `.env.local`):

| Variable | Required | Description |
| --- | --- | --- |
| `KARRIO_API_URL` | Yes | Base URL of the AeroSwift Karrio instance, without a trailing slash. Example: `https://your-karrio-host.example` |
| `KARRIO_API_KEY` | Yes | Karrio API key. Keep this server-side only. |

Tracking flow:

1. AeroSwift first checks whether Karrio already has a tracker for the supplied reference.
2. If it does not, the customer selects the carrier printed on their shipment receipt.
3. AeroSwift creates/queries the Karrio tracker using that carrier and tracking number.
4. The site displays only returned carrier events, ETA and coordinates. If no GPS coordinates are supplied, the map is replaced by a clear unavailable-location state.
5. No sample shipment, invented checkpoint, fabricated ETA or simulated movement is shown.

Karrio supports multiple carrier integrations, including Aramex, DHL Express, FedEx, UPS, TNT, SEKO, DPD, GEODIS, USPS and others. The actual carrier account connections must be configured in the Karrio dashboard before those carrier lookups can return live data. Carrier coverage depends on each carrier integration and its credentials.

Useful references:
- Karrio source: https://github.com/karrioapi/karrio
- Karrio API reference: https://docs.karrio.io/reference/openapi/
- Karrio self-hosting: https://karrio.io/docs

Karrio's open-source server and community plugins use LGPL-3.0; enterprise modules are separately licensed. Review the current license and deployment requirements before enabling enterprise-only features. A hobby deployment recommends approximately 4 GB RAM.

## Enquiry delivery

The package quote, contact and flight enquiry forms use the server-side `POST /api/contact` function. Set:

| Variable | Required | Description |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | Resend API key |
| `AEROSWIFT_ENQUIRY_TO` | Yes | Verified AeroSwift inbox that receives enquiries |
| `AEROSWIFT_ENQUIRY_FROM` | Yes | Verified sender address on a domain authenticated in Resend |

The sender and recipient must be real, verified addresses. No placeholder phone number or email address is published in the site footer.

## Flight services

Flight services currently collect enquiries only. Live flight inventory, availability, ticket issuance and fare confirmation are not connected. Do not present an enquiry as a confirmed booking.

## Customer portal

The customer portal is a clearly labelled future account area. Authentication, customer shipment history and booking management are not enabled yet.

## Production checklist

- Deploy the Karrio instance and connect the carrier accounts AeroSwift is authorized to use.
- Add `KARRIO_API_URL` and `KARRIO_API_KEY` to Vercel Production and Preview environments as appropriate.
- Add the three Resend variables after the company inbox and sender domain have been verified.
- Test tracking with real carrier-issued references for each configured carrier.
- Confirm that the Karrio instance is not configured to return test-mode data for production lookups.
- Confirm actual service coverage, operating regions, commercial terms and company information.
- Add official company contact channels and social profiles only after they are verified.
- Implement customer authentication and portal data access before enabling account functionality.

## API routes

- `POST /api/track` — secure server-side Karrio tracker lookup/create.
- `POST /api/contact` — validated server-side enquiry delivery through Resend.
