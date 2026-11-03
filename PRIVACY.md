# BIMO Privacy Policy (draft)

**Last updated: 3 November 2026**

This draft describes the intended behavior of BIMO as a browser-based, local-first business tool. It is not legal advice. Before publishing, the project owner should verify the live app, hosting configuration, third-party services, and applicable laws, then have the policy reviewed for the places where the app is offered.

## Business data stored on your device

BIMO’s business workspace is designed to store business records in browser storage on the device where you use the app. This may include product and stock details, orders, customer names and contact details, sales sources, expenses, and settings. The app does not provide a BIMO-operated business-data database or automatic cloud sync. Clearing browser/app storage, changing browsers or devices, or losing a device may make local records unavailable. Export backups regularly and keep them somewhere you control.

The BIMO app is hosted online so the browser can download the application and updates. Hosting providers may process routine technical information, such as requests and security logs, according to their own policies and configuration. This project must not claim that absolutely no information is collected without verifying its hosting setup.

## Optional external services

Some features can contact third parties when you choose to use them:

- **Optional AI provider:** If configured and used, your prompt and any business context the app includes are sent from your browser to the AI provider and endpoint you selected. That provider’s privacy, retention, and usage terms apply. Do not send customer or financial details unless you have considered the provider’s terms and have the necessary permission.
- **Google sign-in:** If enabled, Google’s sign-in service processes authentication information under Google’s terms and privacy policy.
- **Bug reports:** Submitting the bug-report form sends the information you enter to the form/hosting service configured by the project. Do not include customer records, passwords, API keys, or sensitive financial data.
- **WhatsApp or other external links:** Opening a follow-up link takes you to the third-party service, which then handles information under its own policies.

The offline business helper is intended to answer from data already available in the browser and does not itself call an AI service.

## API keys and accounts

The current client-side account and settings features save information in browser storage. They are not equivalent to server-backed authentication, encrypted cloud storage, or a secure password manager. Anyone with access to an unlocked device or browser profile may be able to access local app data. Use a device passcode, keep browsers updated, and avoid storing highly sensitive information.

## Your choices

You can choose whether to use optional integrations, export your data, and remove local app data using the app’s controls or your browser settings. A downloaded backup is a separate copy and is not deleted when you clear app storage.

## Children, changes, and contact

BIMO is a business tool, not designed for children. This draft may change as the app and its integrations change. For privacy questions or requests, contact the project maintainer through the repository’s GitHub issues or contact details published by the maintainer.

## Important limitation

This document is a project draft, not a guarantee about every deployment. Self-hosters should review their own hosting, analytics, scripts, integrations, and data practices. The project maintainer should replace this draft with a reviewed policy before treating it as a binding public notice.
