# AeroSwift Global

A responsive, multi-page website foundation for AeroSwift Global, focused on air freight, cargo logistics, shipment visibility and flight enquiries.

## Stack
- React 18 + Vite
- React Router
- Framer Motion
- Lucide icons
- Responsive CSS with reduced-motion support

## Pages
- Overview
- Air freight
- Flight services
- Shipment tracking
- About
- Contact

## Run locally
```bash
npm install
npm run dev
```

## Production integration checklist
The current website is a frontend foundation. Before accepting live customer bookings or presenting operational shipment data:
- Connect shipment tracking to the verified logistics/consignment API.
- Connect flight search to a real inventory and pricing provider, or convert it to a clearly labelled enquiry workflow.
- Replace the sample contact channels with verified company details.
- Connect contact and quote forms to a secure backend and add spam protection.
- Confirm service coverage, operating claims, certifications and company information.
- Replace or approve all remote photography for production use.

Tracking currently confirms that a reference was entered; it does not return live carrier events. Flight and contact forms currently open an email enquiry and do not create bookings.
